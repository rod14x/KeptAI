from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import re
repo=Path(__file__).resolve().parents[2]
out=repo/'cerebro/diagramas'
fontdir=Path('C:/Windows/Fonts')
def font(size,bold=False): return ImageFont.truetype(str(fontdir/('arialbd.ttf' if bold else 'arial.ttf')),size)
# Subconjuntos legibles del DER. Las FK completas se enumeran en la fuente Mermaid.
modules=[('01','Pedidos, vouchers y cobranza',[
('cliente',['id PK · organizacion_id FK','razon_social · ruc_dni'],0,0),
('orden',['id PK · cliente_id FK nullable','estado · total · moneda'],1,0),
('obligacion_cobro',['id PK · orden_id FK UNIQUE','monto · vence_en nullable'],2,0),
('aplicacion_pago',['id PK · pago_id / obligacion_id FK','monto_aplicado · anulada_en'],3,0),
('canal_whatsapp',['id PK · cliente_id FK nullable','instancia · chat_jid (metadatos)'],0,1),
('hoja_resumen',['id PK · orden_id / canal_id FK','extraccion estructurada · version'],1,1),
('aprobacion_credito',['id PK · orden_id FK UNIQUE','decision · aprobado_por FK'],2,1),
('pago',['id PK · cliente_id FK nullable','fase · estado_conciliacion'],3,1),
('orden_item',['id PK · orden_id / linea_id FK','cantidad · precio_unit'],0,2),
('envio_notificacion',['id PK · cliente / orden / obligacion FK','estado · provider_message_id'],1,2),
('alerta_cobranza',['id PK · obligacion_id / pago_id FK','regla · estado · responsable_id FK'],2,2),
('comprobante',['id PK · pago_id FK','archivo_storage_path · archivo_hash'],3,2)
], [('cliente','orden','1 : N'),('cliente','canal_whatsapp','1 : N'),('orden','obligacion_cobro','1 : 0..1'),('obligacion_cobro','aplicacion_pago','1 : N'),('pago','aplicacion_pago','1 : N'),('pago','comprobante','1 : N'),('orden','hoja_resumen','1 : N')]),
('02','Catalogo, produccion y costos',[
('marca',['id PK · organizacion_id FK','nombre'],0,0),
('orden',['REFERENCIA AL MODULO 01','marca_id FK · cierres de costos'],1,0),
('orden_etapa',['id PK · orden_id / unidad_id FK','etapa · estado · responsable_id FK'],2,0),
('unidad_produccion',['id PK · organizacion_id FK','tipo: taller interno / tercero'],3,0),
('linea_producto',['id PK · organizacion_id FK','nombre'],0,1),
('orden_item',['REFERENCIA AL MODULO 01','linea_id FK nullable'],1,1),
('costo_orden',['id PK · orden_id / etapa_id FK','monto · moneda · origen REAL/TEORICO'],2,1),
('transferencia_interna',['id PK · orden_id / unidad_origen_id FK','monto (cargo interno) · anulada_en'],3,1),
('asignacion_costo_item',['id PK · costo_id / orden_item_id FK','monto · metodo · registrado_por FK'],1,2),
('despacho',['id PK · orden_id FK UNIQUE','fecha_despacho -> vence_en (V8)'],3,2)
], [('marca','orden','1 : N'),('orden','orden_etapa','1 : N'),('unidad_produccion','orden_etapa','1 : N'),('linea_producto','orden_item','1 : N'),('orden_etapa','costo_orden','1 : N'),('unidad_produccion','transferencia_interna','1 : N'),('orden_item','asignacion_costo_item','1 : N'),('costo_orden','asignacion_costo_item','1 : N')]),
('03','Organizacion, identidad y soporte',[
('organizacion',['id PK','zona_horaria · moneda_base'],0,0),
('usuario',['id PK · organizacion_id FK','auth_user_id · rol · activo'],1,0),
('integracion_servicio',['id PK · organizacion_id FK','alcance · clave_hash · activo'],2,0),
('evento_auditoria',['id PK · usuario_id FK nullable','operacion · entidad_id · request_id'],3,0),
('solicitud_idempotente',['PK: organizacion_id + operacion + clave','hash_contenido · respuesta'],2,1),
('apertura_caja',['id PK · organizacion_id FK','fecha · moneda · importe'],0,1),
('egreso_caja',['id PK · organizacion_id FK','fecha_prevista · monto · estado'],1,1)
], [('organizacion','usuario','1 : N'),('organizacion','integracion_servicio','1 : N'),('usuario','evento_auditoria','1 : N'),])]
# El ultimo enlace no es una FK: excluirlo del dibujo.
for num,title,nodes,edges in modules:
 im=Image.new('RGB',(2400,1100),'#f5f8fc'); d=ImageDraw.Draw(im)
 d.text((55,35),'KeptAI | DER vigente V9 | '+num,fill='#17345a',font=font(40,True))
 d.text((55,98),title,fill='#355875',font=font(30))
 d.text((55,155),'27 tablas entre las tres laminas. Se muestran campos clave y relaciones principales.',fill='#475569',font=font(23))
 pos={n:(55+c*590,240+r*230) for n,fs,c,r in nodes}
 for a,b,label in edges:
  if label=='NO_FK':continue
  ax,ay=pos[a]; bx,by=pos[b]; w,h=530,155
  if ay==by:
   start=(ax+w if bx>ax else ax,ay+75); end=(bx if bx>ax else bx+w,by+75)
  else: start=(ax+265,ay+h);end=(bx+265,by)
  if ay==by and abs(bx-ax)>590:
   lane=ay-35-(20 if a=='usuario' else 0)
   start=(ax+200,ay); end=(bx+200,by)
   d.line([start,(start[0],lane),(end[0],lane),end],fill='#64748b',width=3)
   mx,my=(start[0]+end[0])//2,lane
  else:
   d.line([start,end],fill='#64748b',width=3)
   mx,my=(start[0]+end[0])//2,(start[1]+end[1])//2
  bb=d.textbbox((0,0),label,font=font(18)); tw=bb[2];d.rectangle((mx-tw/2-5,my-14,mx+tw/2+5,my+14),fill='#f5f8fc');d.text((mx-tw/2,my-12),label,font=font(18),fill='#334155')
 for n,fs,c,r in nodes:
  x,y=pos[n];ref=fs[0].startswith('REFERENCIA'); color='#586a7e' if ref else '#126b80'
  d.rounded_rectangle((x,y,x+530,y+155),radius=12,fill='white',outline=color,width=2)
  d.rounded_rectangle((x,y,x+530,y+49),radius=12,fill=color)
  d.rectangle((x,y+25,x+530,y+49),fill=color)
  d.text((x+15,y+10),n,fill='white',font=font(25,True))
  for i,t in enumerate(fs):d.text((x+15,y+66+i*37),t,fill='#334155',font=font(20))
 d.text((55,955),'FK dentro de la misma empresa: (organizacion_id, id). Todas las tablas de negocio pertenecen a una organizacion.',fill='#334155',font=font(23))
 d.text((55,995),'Sin mensajes persistidos. Voucher en Storage privado. RLS exige identidad activa + organizacion.',fill='#334155',font=font(23))
 d.text((55,1035),'Las FK de autores, revisores y otras relaciones omitidas estan en la fuente editable y en SQL V1-V9.',fill='#64748b',font=font(21))
 im.save(out/f'keptai-der-v9-{num}.png')
# Extraer FK del SQL base, aplicar renombres y eliminaciones V4, y agregar self-FK V6.
base=(repo/'BD/migrations/V1__esquema_inicial.sql').read_text(encoding='utf-8')+'\n'+(repo/'BD/migrations/V3__nota_cliente.sql').read_text(encoding='utf-8')
blocks=re.findall(r'CREATE TABLE (\w+)\s*\((.*?)\n\);',base,re.S)
rename={'chat':'canal_whatsapp','mensaje_saliente':'envio_notificacion'}
relations=[]
for name,body in blocks:
 if name in ('mensaje','contacto','nota_cliente'):continue
 name=rename.get(name,name)
 if name!='organizacion':relations.append(f'  organizacion ||--o{{ {name} : organizacion_id')
 for fields,parent in re.findall(r'FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s+(\w+)',body):
  if parent=='mensaje':continue
  fk=fields.split(',')[-1].strip();fk={'chat_id':'canal_id'}.get(fk,fk)
  unique=bool(re.search(r'UNIQUE\s*\(organizacion_id,\s*'+re.escape(fk)+r'\)',body))
  oldfk='chat_id' if fk=='canal_id' else fk
  required=bool(re.search(r'^\s*'+re.escape(oldfk)+r'\s+[^\n]*NOT NULL',body,re.M))
  if name=='orden' and fk=='cliente_id':required=False
  left='||' if required else '|o'; right='o|' if unique else 'o{'
  relations.append(f'  {rename.get(parent,parent)} {left}--{right} {name} : {fk}')
relations.extend(['  organizacion ||--o{ integracion_servicio : organizacion_id','  pago |o--o{ pago : duplicado_de_pago_id', '  orden ||--o{ costo_orden : orden_id_moneda', '  orden ||--o| obligacion_cobro : orden_id_moneda',
 '  organizacion ||--o{ asignacion_costo_item : organizacion_id','  costo_orden ||--o{ asignacion_costo_item : costo_id','  orden_item ||--o{ asignacion_costo_item : orden_item_id','  usuario |o--o{ asignacion_costo_item : registrado_por',
 '  organizacion ||--o{ transferencia_interna : organizacion_id','  orden ||--o{ transferencia_interna : orden_id_moneda','  unidad_produccion ||--o{ transferencia_interna : unidad_origen_id','  usuario ||--o{ transferencia_interna : registrado_por','  usuario |o--o{ transferencia_interna : anulada_por'])
entities={n:fs for _,_,nodes,_ in modules for n,fs,_,_ in nodes if not fs[0].startswith('REFERENCIA')}
assert len(entities)==27,len(entities)
mermaid='erDiagram\n'+'\n'.join(relations)+'\n'
md='# KeptAI — DER visible y editable (SQL V9)\n\nFecha: 11/10/2026. Fuente: BD/migrations/V1–V9, D-007, D-010. Describe el SQL vigente, aplicado en local y en Supabase (historial Flyway V7 baseline, V8, V9). El [DER V6](keptai-der-v6.md) se conserva como antecedente.\n\n'
for num,title,_,_ in modules:md+=f'## {title}\n\n![DER {title}](keptai-der-v9-{num}.png)\n\n'
md+='## Lectura y alcance\n\nLas tres láminas incluyen las 27 tablas, con referencias repetidas para conectar módulos. Los recuadros grises repiten una tabla de otra lámina. PK = clave primaria; FK = clave foránea. Las líneas muestran relaciones principales, no un recorrido de ejecución. La fuente Mermaid siguiente enumera todas las FK declaradas, incluidos autores/revisores y relaciones opcionales. Campos y restricciones completos: [diccionario](../../BD/diccionario-datos.md) y [migraciones](../../BD/migrations/).\n\nUna orden tiene cero o una obligación, y cada obligación corresponde a una orden. Pago y obligación se vinculan mediante aplicaciones; el pago puede seguir sin cliente identificado. La mora se calcula en una vista, no en cliente. No existe tabla mensaje ni contenido de notificaciones. Las vistas de margen/saldo/mora no son tablas. Auth y Storage son servicios/esquemas de Supabase externos a estas 27 tablas. RLS no se representa como una relación: consultar [revisión SQL/RLS](../../BD/revision-sql-rls.md).\n\n## Cambios desde V6\n\n- **V7 (autorización):** sin tablas ni relaciones nuevas. Crédito solo VENDEDOR, autoría ligada al usuario autenticado, padres financieros congelados con aplicaciones vigentes y lecturas por mínimo privilegio.\n- **V8 (cobranza):** sin tablas nuevas. Insertar un `despacho` pasa la orden a DESPACHADA y fija `obligacion_cobro.vence_en = fecha_despacho + plazo` (trigger). El acta no cambia de fecha ni de orden.\n- **V9 (C-05/C-06):** `asignacion_costo_item` reparte cada costo entre los ítems de su orden, en la misma moneda y sin superar el costo. `transferencia_interna` registra el cargo interno del taller propio: solo taller interno, inmutable salvo anulación y una activa por orden y unidad. El cargo interno no es pago ni caja y se elimina al consolidar.\n\n## Fuente editable — relaciones físicas\n\n```mermaid\n'+mermaid+'```\n\nPara regenerar las imágenes: ejecutar `render-der-v9.py` con Python y Pillow; el generador usa fuentes Arial de Windows.\n'
(out/'keptai-der-v9.md').write_text(md,encoding='utf-8',newline='\n')
