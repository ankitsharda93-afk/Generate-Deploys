"use client";

const sampleCsv = `domain,title,description,image,content
site1,My First Site,Short description,https://picsum.photos/seed/site1/1200/700,"<p>This site was generated from a sheet row.</p><ul><li>Fast</li><li>Simple</li><li>Deployed to Cloudflare Pages</li></ul>"
site2,My Second Site,Another description,https://picsum.photos/seed/site2/1200/700,"<p>Edit your sheet and redeploy anytime.</p>"`;

export function SampleSheetLink() {
  return (
    <a
      className="flex items-center gap-2 rounded-xl bg-indigo-500/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-400 shadow-sm ring-1 ring-indigo-500/20 transition-all hover:bg-indigo-500 hover:text-white hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
      href="/sample-business-profile.pdf"
      download="sample-business-profile.pdf"
      title="Download a sample PDF example for testing"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
        <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" />
      </svg>
      Download Sample PDF
    </a>
  );
}

