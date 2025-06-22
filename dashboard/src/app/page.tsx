import { redirect } from 'next/navigation';

export default function Page() {
  // throw a redirect response to the client
  redirect('/dashboard/overview');
}
