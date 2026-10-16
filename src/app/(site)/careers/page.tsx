import type { Metadata } from "next";
import { Briefcase, Clock, IndianRupee } from "lucide-react";
import { IMAGES } from "@/lib/images";
import { PageHero, Section, SectionHeading } from "@/components/site/Section";
import ApplicationForm from "@/components/site/ApplicationForm";
import { getOpenJobs } from "@/server/queries/public";
import { getSiteSettings, safeLoad } from "@/server/queries/site";
import { JOB_TYPE_LABELS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Careers",
  description: "Join the team at VG Unisex Saloon, Old Rajendra Nagar, Delhi — stylists, beauticians, barbers and front-desk roles.",
};

export default async function CareersPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  const [jobs, settings] = await Promise.all([safeLoad(getOpenJobs, []), getSiteSettings()]);

  return (
    <>
      <PageHero image={IMAGES.stylists} eyebrow="Careers" title="Grow your craft with us">
        {settings.name} is a unisex salon in {settings.address.locality}, {settings.address.city}. We&apos;re always happy to hear from skilled, friendly people who
        love hair, grooming and beauty.
      </PageHero>

      <Section>
        <SectionHeading eyebrow="Open positions" title={jobs.length ? "Current openings" : "No openings right now"}>
          {jobs.length
            ? "Choose a role below to apply. We review every application and contact shortlisted candidates."
            : "We aren't actively hiring at the moment, but you can still send a general application and we'll keep it on file."}
        </SectionHeading>

        {jobs.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2">
            {jobs.map((job) => (
              <article key={job.id} className="flex flex-col rounded-lg border border-beige bg-white p-6">
                <h3 className="font-serif text-2xl">{job.title}</h3>
                <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone">
                  <li className="flex items-center gap-1.5">
                    <Briefcase size={15} aria-hidden /> {JOB_TYPE_LABELS[job.type] ?? job.type}
                  </li>
                  {job.experience && (
                    <li className="flex items-center gap-1.5">
                      <Clock size={15} aria-hidden /> {job.experience}
                    </li>
                  )}
                  {job.salary && (
                    <li className="flex items-center gap-1.5">
                      <IndianRupee size={15} aria-hidden /> {job.salary}
                    </li>
                  )}
                </ul>
                {job.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-stone">{job.description}</p>}
                {job.requirements && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">What we&apos;re looking for</p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone">{job.requirements}</p>
                  </div>
                )}
                <a
                  href={`?role=${job.id}#apply`}
                  className="mt-6 inline-flex w-fit items-center rounded-md bg-charcoal px-5 py-2.5 text-sm font-medium text-ivory hover:bg-charcoal-soft"
                >
                  Apply for this role
                </a>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section tone="cream" id="apply">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
          <div>
            <SectionHeading eyebrow="Apply" title="Send your application" />
            <ul className="space-y-3 text-sm text-stone">
              <li>• Tell us about your experience and the services you&apos;re confident with.</li>
              <li>• Share a link to your work if you have one — Instagram, Google Drive or LinkedIn.</li>
              <li>• Freshers and trainees are welcome to apply for trainee roles.</li>
              <li>• We only use your details for hiring and delete them on request.</li>
            </ul>
          </div>
          <div className="rounded-lg border border-beige bg-white p-6 md:p-8">
            <ApplicationForm key={role ?? "general"} jobs={jobs.map((j) => ({ id: j.id, title: j.title }))} initialRole={role && jobs.some((j) => j.id === role) ? role : ""} />
          </div>
        </div>
      </Section>
    </>
  );
}
