import { HomeView } from "@/modules/home/ui/views/home-view";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const page = async() => {

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in"); {/* this wont actively look if the user is signed in it will only look once and if the user is signed out then it will not check again and redirect back to sign in thats why we use fetchOptions in the home-view*/}
  }

  return (
    <HomeView />
   );
}
export default page;