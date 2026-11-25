import { seedIfEmpty } from "../src/db/seed";
seedIfEmpty(true).then(() => { console.log("reseed done"); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
