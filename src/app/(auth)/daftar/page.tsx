import { redirect } from "next/navigation";

/** Umat create an account simply by signing in (Google or email link). */
export default function RegisterPage() {
  redirect("/masuk?daftar=1");
}
