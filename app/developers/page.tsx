import type { Metadata } from "next";
import { ArrowRight, BookOpen, Code2, KeyRound, Lock, ShieldCheck } from "lucide-react";

import { apiDocSections, developerDocsAuthModel, developerDocsMeta } from "@/lib/api-docs.mjs";

export const metadata: Metadata = {
  title: "Developer API Documentation | Better By Par",
  description: "Read-only Better By Par API documentation for fixtures, statistics, competitions, ladders, LMS, live scoring, and member services."
};

const baseUrl = "https://www.interclubsnooker.com";

export default function DevelopersPage() {
  const firstEndpoint = apiDocSections[0]?.endpoints[0];
  const endpointCount = apiDocSections.reduce((total, section) => total + section.endpoints.length, 0);

  return (
    <main className="min-h-screen bg-[#f7f5fa] text-[#25002b]">
      <section className="border-b border-white/10 bg-[#071426] text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-10 md:grid-cols-[minmax(0,1fr)_430px] md:px-8 lg:py-14">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-wide text-[#04f5ff] ring-1 ring-white/15">
              <BookOpen className="h-4 w-4" />
              Developer docs
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
              Better By Par API
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/72">
              Build read-only league tools using fixtures, cup rounds, statistics, club ladders, Last Man Standing, live scoring, and member-service data.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#quickstart" className="inline-flex items-center gap-2 rounded-xl bg-[#00ff85] px-4 py-3 text-sm font-black text-[#071426]">
                Start with fixtures
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#endpoints" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/15">
                Browse endpoints
              </a>
            </div>
          </div>
          <div className="rounded-2xl bg-[#10233f] p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-black uppercase tracking-wide text-white/55">Example request</span>
              <span className="rounded-lg bg-[#00e5ff] px-2 py-1 text-xs font-black text-[#071426]">GET</span>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-[#071426] p-4 text-sm font-semibold leading-6 text-[#d7fbff]">
              <code>{firstEndpoint?.exampleRequest ?? `curl '${baseUrl}/api/session' -b cookie.txt`}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 md:grid-cols-[250px_minmax(0,1fr)] md:px-8">
        <aside className="hidden md:block">
          <nav className="sticky top-6 grid gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#eeeaf2]">
            <a href="#overview" className="rounded-xl px-3 py-2 text-sm font-black text-[#10233f] hover:bg-[#f7f5fa]">Overview</a>
            <a href="#authentication" className="rounded-xl px-3 py-2 text-sm font-black text-[#10233f] hover:bg-[#f7f5fa]">Authentication</a>
            <a href="#quickstart" className="rounded-xl px-3 py-2 text-sm font-black text-[#10233f] hover:bg-[#f7f5fa]">Quickstart</a>
            {apiDocSections.map((section) => (
              <a key={section.id} href={`#${section.id}`} className="rounded-xl px-3 py-2 text-sm font-black text-[#10233f] hover:bg-[#f7f5fa]">
                {section.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="grid min-w-0 gap-6">
          <section id="overview" className="rounded-2xl bg-white p-5 ring-1 ring-[#eeeaf2] md:p-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DocMetric icon={<Code2 className="h-5 w-5" />} label="Base URL" value={baseUrl} />
              <DocMetric icon={<Lock className="h-5 w-5" />} label="Current auth" value="App session" />
              <DocMetric icon={<ShieldCheck className="h-5 w-5" />} label="Documented" value={`${endpointCount} read endpoints`} />
              <DocMetric icon={<BookOpen className="h-5 w-5" />} label="Updated" value={`${developerDocsMeta.updatedAt} · ${developerDocsMeta.version}`} />
            </div>
          </section>

          <section id="authentication" className="rounded-2xl bg-white p-5 ring-1 ring-[#eeeaf2] md:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#10233f] text-white">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-black">{developerDocsAuthModel.title}</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#6c5a73]">{developerDocsAuthModel.summary}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {developerDocsAuthModel.notes.map((note) => (
                <div key={note} className="rounded-xl bg-[#f7f5fa] p-4 text-sm font-bold leading-6 text-[#10233f] ring-1 ring-[#eeeaf2]">
                  {note}
                </div>
              ))}
            </div>
          </section>

          <section id="quickstart" className="rounded-2xl bg-white p-5 ring-1 ring-[#eeeaf2] md:p-6">
            <p className="text-xs font-black uppercase tracking-wide text-[#6c5a73]">Quickstart</p>
            <h2 className="mt-2 text-2xl font-black">Fetch a league fixture week</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#6c5a73]">
              The API returns JSON. Current third-party experiments should be read-only and use an authenticated app session.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-2xl bg-[#071426] p-5 text-sm font-semibold leading-6 text-[#d7fbff]">
              <code>{`const response = await fetch(
  "${baseUrl}/api/fixtures/weeks?league=A%20League&season=2026/27",
  { credentials: "include" }
);

const data = await response.json();`}</code>
            </pre>
          </section>

          <section id="endpoints" className="grid gap-8">
            {apiDocSections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-6 rounded-2xl bg-white p-5 ring-1 ring-[#eeeaf2] md:p-6">
                <div className="border-b border-[#eeeaf2] pb-5">
                  <p className="text-xs font-black uppercase tracking-wide text-[#6c5a73]">API reference</p>
                  <h2 className="mt-2 text-2xl font-black">{section.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#6c5a73]">{section.description}</p>
                </div>
                <div className="mt-5 grid gap-5">
                  {section.endpoints.map((endpoint) => (
                    <article key={`${endpoint.method}-${endpoint.path}`} className="grid gap-4 rounded-2xl bg-[#fbfafc] p-4 ring-1 ring-[#eeeaf2]">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-lg bg-[#00ff85] px-2.5 py-1 text-xs font-black text-[#071426]">{endpoint.method}</span>
                        <code className="rounded-lg bg-white px-3 py-1.5 text-sm font-black text-[#10233f] ring-1 ring-[#eeeaf2]">{endpoint.path}</code>
                        <span className="rounded-lg bg-[#eeeaf2] px-2.5 py-1 text-xs font-black text-[#6c5a73]">{endpoint.auth}</span>
                      </div>
                      <p className="text-sm font-semibold leading-6 text-[#6c5a73]">{endpoint.summary}</p>
                      {endpoint.query.length ? (
                        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-[#eeeaf2]">
                          <table className="w-full min-w-[620px] text-left text-sm">
                            <thead className="bg-[#f7f5fa] text-xs font-black uppercase text-[#6c5a73]">
                              <tr>
                                <th className="px-3 py-2">Parameter</th>
                                <th className="px-3 py-2">Required</th>
                                <th className="px-3 py-2">Example</th>
                                <th className="px-3 py-2">Description</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#eeeaf2] font-semibold text-[#10233f]">
                              {endpoint.query.map((param) => (
                                <tr key={param.name}>
                                  <td className="px-3 py-3 font-black">{param.name}</td>
                                  <td className="px-3 py-3">{param.required ? "Yes" : "No"}</td>
                                  <td className="px-3 py-3"><code>{param.example}</code></td>
                                  <td className="px-3 py-3 text-[#6c5a73]">{param.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      <div className="grid gap-4 xl:grid-cols-2">
                        <CodeBlock title="Request" code={endpoint.exampleRequest} />
                        <CodeBlock title="Response" code={endpoint.exampleResponse} />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}

function DocMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid gap-3 rounded-xl bg-[#f7f5fa] p-4 ring-1 ring-[#eeeaf2]">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#10233f] ring-1 ring-[#eeeaf2]">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-wide text-[#6c5a73]">{label}</p>
        <p className="mt-1 truncate text-sm font-black text-[#10233f]">{value}</p>
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-[#071426] ring-1 ring-[#10233f]">
      <div className="border-b border-white/10 px-4 py-2 text-xs font-black uppercase tracking-wide text-white/55">{title}</div>
      <pre className="max-h-[360px] overflow-auto p-4 text-xs font-semibold leading-5 text-[#d7fbff]">
        <code>{code}</code>
      </pre>
    </div>
  );
}
