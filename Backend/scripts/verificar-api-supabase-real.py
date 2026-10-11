#!/usr/bin/env python3
"""Aceptación Spring + Auth/Storage Supabase REALES; PostgreSQL DESECHABLE, sin workflows.
Requiere --run-real-storage para subir dos PNG sintéticos y borrarlos al terminar.
No toca DB activa, env, frontend ni procesos ajenos. Ejecutar con venv de contrato y sg docker.
"""
from pathlib import Path
import argparse, base64, hashlib, json, os, re, secrets, signal, socket, subprocess, tempfile, time, urllib.request, urllib.error, uuid
import yaml
ROOT=Path(__file__).resolve().parents[2]

def config(path):
    result={}
    for line in path.read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1);result[k.strip()]=v.strip().strip('"').strip("'")
    return result

def http(url,method='GET',body=None,headers=None):
    h=dict(headers or {})
    if isinstance(body,dict):body=json.dumps(body).encode();h['Content-Type']='application/json'
    request=urllib.request.Request(url,data=body,headers=h,method=method)
    try:
        with urllib.request.urlopen(request,timeout=35) as response:return response.status,dict(response.headers),response.read()
    except urllib.error.HTTPError as error:return error.code,dict(error.headers),error.read()

def checked(url,expected=200,**kwargs):
    status,h,b=http(url,**kwargs)
    if status!=expected:raise RuntimeError('Estado HTTP inesperado: '+str(status)+' esperado '+str(expected))
    return h,b

def run(argv,data=None):
    result=subprocess.run(argv,input=data,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError('Falló proceso '+Path(argv[0]).name+'; salida no publicada para proteger configuración')
    return result.stdout.strip()

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--run-real-storage',action='store_true');parser.add_argument('--port',type=int,default=8094);args=parser.parse_args()
    if not args.run_real_storage:print('Vista previa: DB desechable; Auth y Storage reales; dos PNG sintéticos con limpieza. Añadir --run-real-storage.');return
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1',args.port))==0:raise RuntimeError('Puerto ocupado: no se toca')
    backend=config(ROOT/'Backend/.env');front=config(ROOT/'Frontend/.env.local');auth=config(ROOT/'Frontend/e2e/auth-real.local')
    base=backend['SUPABASE_URL'].rstrip('/');bucket=backend['SUPABASE_STORAGE_BUCKET'];key=backend['SUPABASE_SECRET_KEY'];public=front['VITE_SUPABASE_PUBLISHABLE_KEY']
    if not base.startswith('https://') or front['VITE_SUPABASE_URL'].rstrip('/')!=base:raise RuntimeError('Proyecto Auth/Storage no coincide')
    sh={'apikey':key}
    if key.startswith('eyJ'):sh['Authorization']='Bearer '+key
    _,raw=checked(base+'/storage/v1/bucket/'+bucket,headers=sh)
    if json.loads(raw).get('public') is not False:raise RuntimeError('Bucket no confirmado privado')
    _,raw=checked(base+'/auth/v1/token?grant_type=password',method='POST',headers={'apikey':public},body={'email':auth['E2E_EMAIL'],'password':auth['E2E_PASSWORD']})
    session=json.loads(raw);token=session['access_token'];sub=str(uuid.UUID(session['user']['id']))
    org=str(uuid.uuid4());user=str(uuid.uuid4());customer=str(uuid.uuid4());brand=str(uuid.uuid4());api=secrets.token_hex(32);password=secrets.token_hex(24)
    container='keptai-real-api-'+uuid.uuid4().hex[:12];created=False;spring=None;paths=[];steps=0
    def prove(label,ok=True):
        nonlocal steps
        if not ok:raise RuntimeError('No pasó: '+label)
        steps+=1;print('PASA',steps,label,flush=True)
    def sql(text):return run(['docker','exec','-i',container,'psql','-X','-q','-t','-A','-U','postgres','-d','k','-v','ON_ERROR_STOP=1'],text)
    local='http://127.0.0.1:'+str(args.port)
    def call(method,path,body=None,expected=200,service=False,extra=None):
        h={'X-Api-Key':api} if service else {'Authorization':'Bearer '+token};h.update(extra or {})
        hdr,raw=checked(local+path,expected,method=method,body=body,headers=h)
        return hdr,json.loads(raw)
    def stop():
        nonlocal spring
        if spring is not None:
            try:os.killpg(spring.pid,signal.SIGTERM)
            except ProcessLookupError:pass
            try:spring.wait(timeout=20)
            except subprocess.TimeoutExpired:
                try:os.killpg(spring.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                spring.wait()
            spring=None
    try:
        run(['docker','run','-d','--rm','--name',container,'-e','POSTGRES_PASSWORD=disposable','-e','POSTGRES_DB=k','-p','127.0.0.1::5432','postgres:17-alpine']);created=True
        ready=0
        for _ in range(90):
            try:sql('SELECT 1');ready+=1
            except RuntimeError:ready=0
            if ready>=3:break
            time.sleep(1)
        if ready<3:raise RuntimeError('PostgreSQL no arrancó')
        port=run(['docker','port',container,'5432/tcp']).rsplit(':',1)[1]
        migrations=sorted((ROOT/'BD/migrations').glob('V*.sql'),key=lambda x:int(re.match(r'V(\d+)',x.name)[1]))
        setup='CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA keptai;SET search_path=keptai,public;\n'+'\n'.join(p.read_text() for p in migrations)
        setup+=f"\nCREATE ROLE real_api_app LOGIN INHERIT NOSUPERUSER NOBYPASSRLS PASSWORD '{password}';GRANT keptai_runtime TO real_api_app;"
        setup+=f"\nINSERT INTO keptai.organizacion(id,nombre) VALUES('{org}','Organización ficticia aceptación');INSERT INTO keptai.usuario(id,organizacion_id,auth_user_id,nombre,rol) VALUES('{user}','{org}','{sub}','ADMIN ficticio','ADMIN');"
        setup+=f"\nINSERT INTO keptai.cliente(id,organizacion_id,razon_social,tipo) VALUES('{customer}','{org}','Cliente sintético','EMPRESA');INSERT INTO keptai.marca(id,organizacion_id,nombre) VALUES('{brand}','{org}','Marca sintética');INSERT INTO keptai.contacto(organizacion_id,cliente_id,nombre,whatsapp_jid) VALUES('{org}','{customer}','Contacto sintético','51900000001@s.whatsapp.net');"
        setup+=f"\nINSERT INTO keptai.integracion_servicio(organizacion_id,instancia,alcance,clave_hash) VALUES('{org}','isabel','INGESTA','{hashlib.sha256(api.encode()).hexdigest()}');"
        sql(setup);prove('Migraciones actuales en PostgreSQL desechable; login runtime sin bypass')
        with tempfile.TemporaryDirectory(prefix='keptai-real-api-') as temp:
            os.chmod(temp,0o700);log=Path(temp)/'spring.log'
            env=os.environ.copy();env.update(backend);env.update({'JAVA_HOME':'/usr/lib/jvm/java-21-openjdk-amd64','PATH':'/usr/lib/jvm/java-21-openjdk-amd64/bin:/usr/bin:/bin','KEPTAI_LOCAL_ENV':'/nonexistent','KEPTAI_DB_PORT':port,'KEPTAI_DB_NAME':'k','KEPTAI_RUNTIME_USER':'real_api_app','KEPTAI_RUNTIME_PASSWORD':password,'PORT':str(args.port)})
            def start():
                nonlocal spring
                with log.open('ab') as output:spring=subprocess.Popen(['./mvnw','-B','-o','-q','spring-boot:run','-Dspring-boot.run.profiles=local'],cwd=ROOT/'Backend',env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
                for _ in range(100):
                    if spring.poll() is not None:raise RuntimeError('Spring no arrancó; log privado temporal')
                    try:
                        st,_,b=http(local+'/actuator/health')
                        if st==200 and json.loads(b)['status']=='UP':return
                    except (OSError,ValueError):pass
                    time.sleep(1)
                raise RuntimeError('Spring no quedó disponible')
            start();_,me=call('GET','/api/v1/me');prove('JWT Supabase real → Spring → /me',me['user_id']==user and me['organization_id']==org and me['role']=='ADMIN')
            doc=yaml.safe_load((ROOT/'Backend/docs/openapi.yaml').read_text());order=doc['components']['examples']['N8nIngestaCredit']['value'];order.update({'instancia':'isabel','chatId':'51900000001@s.whatsapp.net','transcript':'TRANSCRIPT_NO_PERSISTIR_REAL_API','hojaResumenMd':'HOJA_NO_PERSISTIR_REAL_API'})
            _,ing=call('POST','/api/v1/ordenes/ingesta',order,201,True);oid=ing['ordenId'];_,replay=call('POST','/api/v1/ordenes/ingesta',order,201,True);prove('Ingesta persistente y replay por HTTP',ing==replay)
            voucher=json.loads((ROOT/'Backend/docs/ejemplos/wf2-voucher-ficticio.json').read_text());voucher['mensajeId']='DEMO-'+uuid.uuid4().hex;voucher['extraccion']['codigo_operacion']='DEMO-'+uuid.uuid4().hex[:16]
            _,pay=call('POST','/api/v1/pagos/voucher',voucher,201,True);payment=pay['pagoId'];paths[:]=sql('SELECT archivo_storage_path FROM keptai.comprobante').splitlines();prove('WF2 sintético → API → voucher en Supabase real',len(paths)==1)
            prove('Pago recibido, no verificado ni aplicado',pay['fase']=='RECIBIDO' and not pay['fondosVerificados'] and not pay['saldoModificado'])
            _,page=call('GET','/api/v1/evidences');evidence=page['items'][0];eid=evidence['id'];rawimage=base64.b64decode(voucher['imagen_base64']);prove('Metadatos privados corresponden al archivo',evidence['sha256']==hashlib.sha256(rawimage).hexdigest())
            hdr,link=call('GET',f'/api/v1/evidences/{eid}/download-link');prove('Enlace desde API sin caché',hdr.get('Cache-Control')=='no-store')
            _,download=checked(link['url']);prove('Descarga firmada Supabase sin clave conserva bytes',download==rawimage)
            path=paths[0];status,_,_=http(base+'/storage/v1/object/public/'+bucket+'/'+path);prove('Voucher no público',status!=200)
            status,_,_=http(local+f'/api/v1/evidences/{eid}/download-link');prove('Anónimo no obtiene enlace privado',status==401)
            boundary='keptai-'+secrets.token_hex(12)
            multipart=b''
            for name,value in [('payment_id',payment),('kind','voucher_image'),('label','Demo sintética')]:multipart+=f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
            multipart+=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="demo.png"\r\nContent-Type: image/png\r\n\r\n'.encode()+rawimage+f'\r\n--{boundary}--\r\n'.encode()
            _,manual=call('POST','/api/v1/evidences/files',multipart,201,extra={'Content-Type':'multipart/form-data; boundary='+boundary,'Idempotency-Key':'manual-real-demo'});paths[:]=sql('SELECT archivo_storage_path FROM keptai.comprobante').splitlines();prove('Carga manual real autorizada',manual['uploaded_by_user_id']==user)
            _,again=call('POST','/api/v1/evidences/files',multipart,201,extra={'Content-Type':'multipart/form-data; boundary='+boundary,'Idempotency-Key':'manual-real-demo'});prove('Replay manual no duplica objeto',again==manual and len(paths)==2)
            _,drafts=call('GET','/api/v1/drafts');draft=drafts['items'][0];did=draft['id']
            body={'expected_revision':draft['revision'],'order_fields':{'brand':'Marca sintética'},'items':[{'description':'Polos sintéticos','quantity':10,'unit_price':{'amount_cents':1000,'currency':'PEN'}}],'payment_condition':'CREDITO','credit_term_days':30}
            _,draft=call('PATCH',f'/api/v1/drafts/{did}',body);prove('Corrección humana auditada por HTTP',draft['reviewed_by_user_id']==user)
            confirmation={'expected_revision':draft['revision']};_,confirmed=call('POST',f'/api/v1/drafts/{did}/confirmation',confirmation,extra={'Idempotency-Key':'confirm-real-demo'});prove('Confirmación persistente sin fondos',confirmed['order_id']==oid and not confirmed['funds_verified'] and not confirmed['balance_changed'])
            decision={'decision':'approved','arrears_notice_acknowledged':True,'credit_term_days':30};_,credit=call('POST',f'/api/v1/orders/{oid}/credit-decision',decision,extra={'Idempotency-Key':'credit-real-demo'});prove('ADMIN real autoriza crédito y genera obligación',sql(f"SELECT count(*) FROM keptai.obligacion_cobro WHERE orden_id='{oid}'")== '1')
            stop();start();_,saved=call('GET',f'/api/v1/drafts/{did}');prove('Borrador confirmado persiste tras reinicio',saved==confirmed['draft'])
            _,savedcredit=call('POST',f'/api/v1/orders/{oid}/credit-decision',decision,extra={'Idempotency-Key':'credit-real-demo'});prove('Replay de crédito persiste tras reinicio',savedcredit==credit)
            _,savedorder=call('GET',f'/api/v1/orders/{oid}');prove('Pedido consultable tras reinicio',savedorder['id']==oid)
            _,savedlink=call('GET',f'/api/v1/evidences/{eid}/download-link');_,savedfile=checked(savedlink['url']);prove('Voucher privado consultable tras reinicio',savedfile==rawimage)
            otherorg=str(uuid.uuid4());otheruser=str(uuid.uuid4())
            sql(f"INSERT INTO keptai.organizacion(id,nombre) VALUES('{otherorg}','Otra organización ficticia');INSERT INTO keptai.usuario(id,organizacion_id,auth_user_id,nombre,rol) VALUES('{otheruser}','{otherorg}','{sub}','Otro ADMIN ficticio','ADMIN')")
            st,_,_=http(local+'/api/v1/me',headers={'Authorization':'Bearer '+token});prove('JWT real con dos membresías devuelve 409 sin elegir organización',st==409)
            sql(f"UPDATE keptai.usuario SET activo=false WHERE id='{user}'")
            _,otheridentity=call('GET','/api/v1/me');prove('Membresía vigente se resuelve desde PostgreSQL',otheridentity['organization_id']==otherorg)
            for resource in (f'/api/v1/orders/{oid}',f'/api/v1/evidences/{eid}/download-link'):
                st,_,_=http(local+resource,headers={'Authorization':'Bearer '+token});prove('Otro tenant real no accede a recurso privado',st==404)
            sql(f"DELETE FROM keptai.usuario WHERE id='{otheruser}';UPDATE keptai.usuario SET activo=true WHERE id='{user}'")
            for role in ('GERENTE','VENDEDOR','JEFE_TALLER'):
                sql(f"UPDATE keptai.usuario SET rol='{role}' WHERE id='{user}'")
                _,identity=call('GET','/api/v1/me');prove('JWT real obtiene rol '+role+' desde DB',identity['role']==role)
                st,_,_=http(local+f'/api/v1/evidences/{eid}/download-link',headers={'Authorization':'Bearer '+token});prove(role+' no obtiene enlace privilegiado',st==403)
            sql(f"UPDATE keptai.usuario SET rol='ADMIN' WHERE id='{user}'")
            data=sql("SELECT row_to_json(x)::text FROM keptai.hoja_resumen x UNION ALL SELECT row_to_json(x)::text FROM keptai.solicitud_idempotente x UNION ALL SELECT row_to_json(x)::text FROM keptai.evento_auditoria x")
            logged=log.read_text(errors='replace');prove('Sin transcript, hoja entrante, Base64 ni credenciales en persistencia/logs',all(x not in data+logged for x in ['TRANSCRIPT_NO_PERSISTIR_REAL_API','HOJA_NO_PERSISTIR_REAL_API',voucher['imagen_base64'],token,key,api]))
            print('ACEPTACIÓN REAL API:',steps,'comprobaciones; no ejecuta workflows originales ni despliegue.',flush=True)
    finally:
        stop()
        if created:
            try:paths[:]=sql('SELECT archivo_storage_path FROM keptai.comprobante').splitlines()
            except RuntimeError:pass
        cleanup=True
        for path in paths:
            if not path.startswith(org+'/vouchers/'):cleanup=False;continue
            try:
                status,_,_=http(base+'/storage/v1/object/'+bucket+'/'+path,method='DELETE',headers=sh)
                if status not in (200,204):cleanup=False
            except OSError:cleanup=False
        if created:run(['docker','rm','-f',container])
        if not cleanup:raise RuntimeError('Limpieza Storage incompleta; requiere conciliación de objetos de la organización de prueba')
        print('Limpieza: objetos sintéticos y PostgreSQL desechable eliminados; procesos propios detenidos.',flush=True)

if __name__=='__main__':
    try:main()
    except (RuntimeError,OSError,KeyError,ValueError) as error:
        # No publicar cuerpos remotos ni traceback con variables de credenciales.
        print('FALLA:',str(error) if isinstance(error,RuntimeError) else type(error).__name__,flush=True)
        raise SystemExit(1)
