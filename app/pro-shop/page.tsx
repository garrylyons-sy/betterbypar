import {currentUser} from '@/lib/server/auth';
import {ProShop} from '@/components/pro-shop';
export const dynamic='force-dynamic';
export const metadata={title:'Pro shop — Better By Par'};
export default async function ProShopPage(){const user=await currentUser();return <main className="mx-auto min-h-screen max-w-6xl p-4 sm:p-8">{user?<ProShop/>:<p><a href="/" className="underline">Sign in to visit your club’s pro shop</a></p>}</main>;}
