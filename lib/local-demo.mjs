export function localDemoEnabled(environment=process.env){
  return environment.NODE_ENV==='development'&&environment.LOCAL_DEMO==='1';
}
export const localDemoPassword='LocalGolf2026!';
export const localDemoAccounts=[
  {key:'admin',name:'Alex Morgan',email:'admin@example.test',role:'Platform Admin',destination:'/admin'},
  {key:'clubadmin',name:'Jamie Taylor',email:'clubadmin@example.test',role:'Club Admin',destination:'/clubadmin'},
  {key:'professional',name:'Colin Clancy',email:'professional@example.test',role:'Golf Professional',destination:'/lessons/manage'},
  {key:'assistant',name:'Shane Comer',email:'assistant@example.test',role:'Assistant Professional',destination:'/lessons/manage'},
  {key:'parent',name:'Jordan Parker',email:'parent@example.test',role:'Parent / Guardian',destination:'/family'},
  {key:'member',name:'Morgan Kelly',email:'member@example.test',role:'Club Member',destination:'/'},
];

export function localDemoEnvironment(environment=process.env,appPort=3500,dbPort=55432){
  if(![appPort,dbPort].every(p=>Number.isInteger(p)&&p>0&&p<=65535))throw new Error('Choose valid local demo ports.');
  return {...environment,NODE_ENV:'development',LOCAL_DEMO:'1',
    DATABASE_URL:`postgresql://postgres:postgres@127.0.0.1:${dbPort}/postgres`,PGSSLMODE:'disable',
    NEXT_PUBLIC_APP_URL:`http://127.0.0.1:${appPort}`,APP_URL:`http://127.0.0.1:${appPort}`,
    RESEND_API_KEY:'',INVITE_FROM_EMAIL:'',EMAIL_FROM:'',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',
    SUPABASE_URL:'',SUPABASE_SERVICE_ROLE_KEY:'',NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_ANON_KEY:'',
    GOLF_IRELAND_DATA_MODE:'demo',GOLF_IRELAND_CLUB_CREDENTIALS:'',GOLF_IRELAND_MEMBER_UIDS:'',
    VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:'',CRON_SECRET:'',NEXT_TELEMETRY_DISABLED:'1'
  };
}
