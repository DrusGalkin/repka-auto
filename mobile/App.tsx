import React,{useEffect,useRef,useState} from 'react';
import {SafeAreaView,ScrollView,View,Text,Pressable,StyleSheet,PermissionsAndroid,Platform} from 'react-native';
import {BleManager,Device,Subscription,State} from 'react-native-ble-plx';
import {Decoder,SERVICE,CHARACTERISTIC} from './protocol';
type Snapshot={v:number;demo:boolean;status:string;ts:number;metrics:Record<string,[number|null,string,number]>};
const names:Record<string,string>={RPM:'Обороты двигателя',SPEED:'Скорость',COOLANT_TEMP:'Температура ОЖ',ENGINE_LOAD:'Нагрузка',THROTTLE_POS:'Дроссель',INTAKE_TEMP:'Температура впуска',INTAKE_PRESSURE:'Давление впуска',MAF:'Расход воздуха',FUEL_LEVEL:'Топливо',CONTROL_MODULE_VOLTAGE:'Напряжение ЭБУ',TIMING_ADVANCE:'Угол зажигания',SHORT_FUEL_TRIM_1:'Краткая коррекция',LONG_FUEL_TRIM_1:'Длинная коррекция',FUEL_PRESSURE:'Давление топлива',OIL_TEMP:'Температура масла',RUN_TIME:'Время работы',DISTANCE_W_MIL:'Пробег с MIL'};
const units:Record<string,string>={rpm:'об/мин','km/h':'км/ч',degC:'°C',percent:'%',volt:'В',second:'с',degree:'°',km:'км','g/s':'г/с',kPa:'кПа'};
export default function App(){
 const manager=useRef<BleManager|null>(null),device=useRef<Device|null>(null),monitor=useRef<Subscription|null>(null),disconnect=useRef<Subscription|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),alive=useRef(true),busy=useRef(false),generation=useRef(0);
 const [devices,setDevices]=useState<Device[]>([]),[message,setMessage]=useState('Подключитесь к Repka Pi'),[data,setData]=useState<Snapshot|null>(null),[now,setNow]=useState(Date.now()),[linked,setLinked]=useState(false);
 function clear(){generation.current++;manager.current?.stopDeviceScan();if(timer.current)clearTimeout(timer.current);monitor.current?.remove();disconnect.current?.remove();monitor.current=null;disconnect.current=null;if(device.current)device.current.cancelConnection().catch(()=>{});device.current=null;busy.current=false;setLinked(false);setData(null);}
 useEffect(()=>{alive.current=true;manager.current=new BleManager();const tick=setInterval(()=>setNow(Date.now()),1000);return()=>{alive.current=false;generation.current++;clearInterval(tick);if(timer.current)clearTimeout(timer.current);monitor.current?.remove();disconnect.current?.remove();manager.current?.destroy();};},[]);
 async function connect(id:string,retry=0){
   if(!alive.current||!manager.current||busy.current)return;
   busy.current=true;const g=generation.current;setMessage(retry?'Переподключение…':'Подключение…');manager.current.stopDeviceScan();
   try{
     const d=await manager.current.connectToDevice(id,{timeout:12000});
     if(g!==generation.current||!alive.current){await d.cancelConnection();return;}
     device.current=d;await d.discoverAllServicesAndCharacteristics();
     if(g!==generation.current||!alive.current){await d.cancelConnection();return;}
     const decoder=new Decoder();
     disconnect.current?.remove();
     disconnect.current=d.onDisconnected(()=>{monitor.current?.remove();device.current=null;setLinked(false);setData(null);busy.current=false;if(alive.current&&g===generation.current){setMessage('Связь потеряна');timer.current=setTimeout(()=>connect(id,retry+1),Math.min(1000*2**Math.min(retry,4),15000));}});
     monitor.current=d.monitorCharacteristicForService(SERVICE,CHARACTERISTIC,(err,c)=>{if(g!==generation.current||!alive.current)return;if(err){setMessage(err.message);d.cancelConnection().catch(()=>{});return;}if(c?.value){const s=decoder.push(c.value);if(s)setData(s as Snapshot);}});
     setLinked(true);setMessage('Repka Pi подключён');
   }catch(e){if(alive.current&&g===generation.current){setMessage(String(e));device.current?.cancelConnection().catch(()=>{});device.current=null;if(retry>0)timer.current=setTimeout(()=>connect(id,retry+1),15000);}}
   finally{if(g===generation.current)busy.current=false;}
 }
 async function scan(){
   clear();setDevices([]);
   try{
    if(Platform.OS==='android'){
     const perms=Number(Platform.Version)>=31?[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]:[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
     const result=await PermissionsAndroid.requestMultiple(perms);
     if(perms.some(p=>result[p]!==PermissionsAndroid.RESULTS.GRANTED))throw Error('Разрешите Bluetooth в настройках приложения');
    }
    if(await manager.current?.state()!==State.PoweredOn)throw Error('Включите Bluetooth и повторите поиск');
    setMessage('Поиск Repka Pi…');
    manager.current?.startDeviceScan([SERVICE],null,(err,d)=>{if(!alive.current)return;if(err){manager.current?.stopDeviceScan();setMessage(err.message);return;}if(d)setDevices(prev=>prev.some(x=>x.id===d.id)?prev:[...prev,d]);});
    timer.current=setTimeout(()=>{manager.current?.stopDeviceScan();setMessage('Поиск завершён. Выберите устройство или повторите поиск');},12000);
   }catch(e){setMessage(String(e));}
 }
 const stale=!data||now/1000-data.ts>15;
 return <SafeAreaView style={s.page}><ScrollView contentContainerStyle={s.content}><Text style={s.eyebrow}>БОРТОВОЙ КОМПЬЮТЕР</Text><Text style={s.title}>Repka Auto</Text><Text style={s.status}>{message}</Text><Pressable style={s.button} onPress={scan}><Text style={s.buttonText}>Найти Repka Pi</Text></Pressable>{linked&&<Pressable onPress={()=>{clear();setMessage('Отключено');}}><Text style={s.status}>Отключиться</Text></Pressable>}{!linked&&devices.map(d=><Pressable style={s.card} key={d.id} onPress={()=>{if(timer.current)clearTimeout(timer.current);connect(d.id);}}><Text style={s.label}>{d.name||'Repka Auto'}</Text><Text style={s.unit}>{d.id}</Text></Pressable>)}{data?.demo&&<Text style={s.warning}>ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ</Text>}<Text style={s.status}>{stale?'Нет актуальных данных':data?.status==='connected'?'Автомобиль подключён':'Нет связи с ЭБУ'}</Text><View style={s.grid}>{Object.entries(names).map(([key,label])=>{const [value,unit,ts]=data?.metrics[key]||[null,'',0];const fresh=!stale&&value!==null&&now/1000-ts<15;return <View style={s.metric} key={key}><Text style={s.label}>{label}</Text><Text style={s.value}>{fresh?value:'—'}</Text><Text style={s.unit}>{fresh?(units[unit]||unit):'Нет данных'}</Text></View>;})}</View><Text style={s.unit}>OBD2 · Только чтение</Text></ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#0b111b'},content:{padding:20,paddingTop:36},eyebrow:{color:'#91a5bd',letterSpacing:2,fontSize:11},title:{color:'#edf5ff',fontSize:38,fontWeight:'700',marginVertical:10},status:{color:'#91a5bd',marginVertical:12},button:{backgroundColor:'#68e0c0',padding:17,borderRadius:14,marginVertical:8},buttonText:{color:'#09251e',fontWeight:'700',textAlign:'center'},grid:{flexDirection:'row',flexWrap:'wrap',gap:12,marginVertical:12},metric:{width:'48%',backgroundColor:'#162131',borderRadius:18,padding:16,minHeight:145},card:{backgroundColor:'#162131',padding:18,borderRadius:14,marginVertical:6},label:{color:'#d9e5f5',fontSize:14},value:{color:'#68e0c0',fontSize:34,marginVertical:10},unit:{color:'#91a5bd',fontSize:12},warning:{color:'#ffcf70',marginVertical:12}});
