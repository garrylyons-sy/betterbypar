import {currentUser} from '@/lib/server/auth';
import {ProShopAdmin} from '@/components/pro-shop-admin';
export const dynamic='force-dynamic';
export const metadata={title:'Manage pro shop — Better By Par'};
export default async function ManageShopPage(){const user=await currentUser();return <main className="mx-auto min-h-screen max-w-6xl p-4 sm:p-8">{user?<ProShopAdmin/>:<a className="underline" href="/">Sign in to manage your pro shop</a>}</main>;}
