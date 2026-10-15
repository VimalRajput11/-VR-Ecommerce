import type { Metadata } from "next";
import { Suspense } from "react";
import AuthForm from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-serif text-3xl">Welcome back</h1>
      <p className="mt-1 mb-8 text-sm text-stone">Sign in to manage your appointments, invoices and offers.</p>
      <div className="rounded-xl border border-beige bg-white p-6">
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      </div>
    </div>
  );
}
