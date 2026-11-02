export const customerMenuItems=[
 {label:'Home',section:'Home',href:'/'},
 {label:'My Golf',section:'My Golf',href:'/my-golf'},
 {label:'Lessons',section:'Lessons',href:'/lessons'},
 {label:'Club',section:'Club',href:'/?page=Club'},
 {label:'More',section:'Menu',href:'/?page=Menu'}
];
const sections={'/my-golf':'My Golf','/practice':'My Golf','/practice/manage':'My Golf','/rounds/review':'My Golf','/rounds/coaching':'My Golf','/lessons':'Lessons','/lessons/manage':'Lessons','/family':'Menu','/profile':'Menu','/second-hand-clubs':'Menu'};
export function customerSection(pathname){return sections[pathname.replace(/\/$/,'')]??null;}
export function customerRootPage(value){return ['Home','My Golf','Lessons','Club','Menu'].includes(value)?value:null;}
