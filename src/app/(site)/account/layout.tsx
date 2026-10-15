import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth/session";

export const metadata = { title: "My account", robots: { index: false } };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  let user = null;
  try {
    user = await getSessionUser();
  } catch {
    // DB unavailable: fall through to the sign-in page, which shows the error on submit.
  }
  if (!user) redirect("/login?next=/account");
  return <div className="mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-14">{children}</div>;
}
