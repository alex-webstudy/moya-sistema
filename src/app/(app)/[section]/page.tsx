import { PROTOTYPE_URL, UPCOMING } from "@/lib/sections";

// Placeholder for sections that are planned but not built yet: what it will do and when.
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(UPCOMING).map((section) => ({ section }));

export default async function Upcoming({ params }: PageProps<"/[section]">) {
  const s = UPCOMING[(await params).section];
  return (
    <>
      <div className="head"><div><h1>{s.name}</h1><div className="sub">Раздел появится: {s.stage}</div></div></div>
      <section className="panel">
        <h2>Что здесь будет</h2>
        {s.about.map((x, i) => <div key={i} className="sub" style={{ fontSize: 14, padding: "4px 0" }}>• {x}</div>)}
        <a className="btn" style={{ marginTop: 14, display: "inline-flex", textDecoration: "none" }} href={PROTOTYPE_URL} target="_blank" rel="noreferrer">Посмотреть в черновике ↗</a>
      </section>
    </>
  );
}
