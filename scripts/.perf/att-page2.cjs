const fs = require("fs");
const p = "src/app/(app)/attendance/page.tsx";
let s = fs.readFileSync(p, "utf8");
const a = "        </table>\n      </Card>\n    </div>\n  );";
if (!s.includes(a)) { console.error("MISSING table end"); process.exit(1); }
s = s.replace(a, "        </table>\n        <Pager page={page} pages={Math.ceil(shown / PAGE)} makeHref={(p) => `/attendance${qs(sp, { page: p })}`} />\n      </Card>\n    </div>\n  );");
const b = "subtitle={`${WEEKDAYS_EN[date.getUTCDay()]}, ${dmy(date)} · ${int(rawPunches)} raw punches on this date`}";
if (!s.includes(b)) { console.error("MISSING subtitle"); process.exit(1); }
s = s.replace(b, "subtitle={`${WEEKDAYS_EN[date.getUTCDay()]}, ${dmy(date)} · ${int(rawPunches)} raw punches on this date · ${int(shown)} ${shown === 1 ? \"row\" : \"rows\"}`}");
fs.writeFileSync(p, s);
console.log("ok");
