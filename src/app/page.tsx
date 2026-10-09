import fs from "node:fs";
import path from "node:path";
import PortfolioApp from "@/components/PortfolioApp";
import { portfolio, type Portfolio } from "@/data/portfolio";
import { display, mono } from "./fonts";

/** If the résumé is a local file that hasn't been added to /public yet, show it as a placeholder instead of a dead link. */
function withResumeCheck(data: Portfolio): Portfolio {
  const url = data.resumeUrl;
  if (!url || url === "#" || /^https?:\/\//.test(url)) return data;
  const exists = fs.existsSync(path.join(process.cwd(), "public", url.replace(/^\//, "")));
  return exists ? data : { ...data, resumeUrl: "#" };
}

export default function Page() {
  return (
    <PortfolioApp
      data={withResumeCheck(portfolio)}
      fonts={{ display: display.style.fontFamily, mono: mono.style.fontFamily }}
    />
  );
}
