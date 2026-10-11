#!/usr/bin/env python3
"""Humo Docker prod con PostgreSQL desechable; no usa .env ni servicios externos.
Uso: sg docker -c 'python3 Backend/scripts/verificar-docker-local.py --image keptai-backend:predeploy'
"""
from pathlib import Path
import argparse, hashlib, json, os, re, secrets, subprocess, tempfile, time, urllib.request, urllib.error, uuid
ROOT=Path(__file__).resolve().parents[2]
def run(args,data=None):
    result=subprocess.run(args,input=data,text=True,capture_output=True)
    if result.returncode:raise RuntimeError('Falló '+args[0]+'; salida privada no publicada')
    return result.stdout.strip()
def status(url,body=None,key=None):
    headers={'Content-Type':'application/json'}
    if key:headers['X-Api-Key']=key
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=body,headers=headers),timeout=3) as r:return r.status,r.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--image',default='keptai-backend:predeploy');a=p.parse_args()
    config=json.loads(run(['docker','image','inspect',a.image]))[0]['Config']
    assert config['User']=='10001:10001','La imagen debe usar usuario sin privilegios'
    assert not any('SECRET_KEY=' in x or 'PASSWORD=' in x for x in config.get('Env',[])),'Secretos en imagen'
    suffix=uuid.uuid4().hex[:12];network='keptai-smoke-'+suffix;db=network+'-db';app=network+'-api';password=secrets.token_hex(24);key=secrets.token_hex(32);made=[]
    def sql(statement):return run(['docker','exec','-i',db,'psql','-X','-q','-t','-A','-U','postgres','-d','k','-v','ON_ERROR_STOP=1'],statement)
    try:
        run(['docker','network','create',network]);made.append(('network',network))
        run(['docker','run','-d','--name',db,'--network',network,'--network-alias','db','-e','POSTGRES_PASSWORD=disposable','-e','POSTGRES_DB=k','postgres:17-alpine']);made.append(('container',db))
        ready=0
        for _ in range(90):
            try:sql('SELECT 1');ready+=1
            except RuntimeError:ready=0
            if ready>=3:break
            time.sleep(1)
        if ready<3:raise RuntimeError('PostgreSQL no arrancó')
        migrations=sorted((ROOT/'BD/migrations').glob('V*.sql'),key=lambda x:int(re.match(r'V(\d+)',x.name)[1]))
        setup='CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA keptai;SET search_path=keptai,public;\n'+'\n'.join(x.read_text() for x in migrations)
        setup+=f"\nCREATE ROLE smoke_app LOGIN INHERIT NOSUPERUSER NOBYPASSRLS PASSWORD '{password}';GRANT keptai_runtime TO smoke_app;"
        org=str(uuid.uuid4());setup+=f"\nINSERT INTO keptai.organizacion(id,nombre) VALUES('{org}','Docker ficticio');INSERT INTO keptai.integracion_servicio(organizacion_id,instancia,alcance,clave_hash) VALUES('{org}','isabel','INGESTA','{hashlib.sha256(key.encode()).hexdigest()}');"
        sql(setup)
        with tempfile.TemporaryDirectory(prefix='keptai-docker-smoke-') as temp:
            os.chmod(temp,0o700);env=Path(temp)/'runtime.env'
            env.write_text('SPRING_PROFILES_ACTIVE=prod\nPORT=8080\nSPRING_DATASOURCE_URL=jdbc:postgresql://db:5432/k?currentSchema=keptai\nSPRING_DATASOURCE_USERNAME=smoke_app\nSPRING_DATASOURCE_PASSWORD='+password+'\n');env.chmod(0o600)
            run(['docker','run','-d','--name',app,'--network',network,'-p','127.0.0.1::8080','--read-only','--tmpfs','/tmp:rw,nosuid,size=128m','--cap-drop','ALL','--security-opt','no-new-privileges','--env-file',str(env),a.image]);made.append(('container',app))
            port=run(['docker','port',app,'8080/tcp']).rsplit(':',1)[1];base='http://127.0.0.1:'+port
            for _ in range(100):
                try:
                    code,body=status(base+'/actuator/health')
                    if code==200 and json.loads(body)['status']=='UP':break
                except (OSError,ValueError):pass
                time.sleep(1)
            else:raise RuntimeError('Health Docker prod no quedó UP')
            assert run(['docker','exec',app,'id','-u'])=='10001'
            print('PASA: prod, health UP, uid10001, rootfs solo lectura, sin capabilities',flush=True)
            for route in ('/api/v1/ordenes/ingesta','/api/v1/pagos/voucher'):
                for credential,expected in ((None,401),('0'*64,401),(key,400)):
                    actual,_=status(base+route,b'{}',credential)
                    assert actual==expected,route+' HTTP '+str(actual)+' esperado '+str(expected)
                print('PASA:',route,'sin clave401/desconocida401/válida400',flush=True)
            assert status(base+'/api/v1/me')[0]==401
            assert sql('SELECT (SELECT count(*) FROM keptai.orden)+(SELECT count(*) FROM keptai.pago)')=='0'
            print('PASA: panel sin JWT401, peticiones inválidas no crean negocio; migraciones actuales con runtime sin bypass',flush=True)
            print('DOCKER PROD OK; no es despliegue público ni aceptación n8n real.',flush=True)
    finally:
        for kind,name in reversed(made):
            run(['docker','rm','-f',name] if kind=='container' else ['docker','network','rm',name])
        print('Limpieza: contenedores, red y env propios eliminados.',flush=True)
if __name__=='__main__':
    try:main()
    except (RuntimeError,AssertionError,OSError,ValueError,KeyError) as e:
        print('FALLA:',str(e) if isinstance(e,(RuntimeError,AssertionError)) else type(e).__name__);raise SystemExit(1)
