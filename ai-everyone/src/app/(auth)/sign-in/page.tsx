// Card component is used to wrap the sign-up content in a styled container.
import { SignInView } from "@/modules/auth/views/sign-in-views"
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const Page = async() => {

    const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (!!session) {
        redirect("/"); {/* opposit of the logic used in the home page, if the user is already logged in, redirect to home */}
      }

    return (
        <SignInView />
    );
}
 
export default Page;