import { promptUser } from "./prompt.js";
import { setupNextjsProject } from "./setup-nextjs.js";
import { setupOrm } from "./setup-orm.js";
import { setupDatabase } from "./setup-database.js";
import { setupAuth } from "./setup-auth.js";
import { setupShadcn } from "./setup-shadcn.js";

async function main() {
  try {
    // Step 1 – collect all user choices
    const choices = await promptUser();

    // Step 2 – scaffold the Next.js project
    await setupNextjsProject(choices);

    // Step 3 – set up the selected ORM
    await setupOrm(choices);

    // Step 4 – set up the database (docker-compose + env vars)
    await setupDatabase(choices);

    // Step 5 – set up authentication
    await setupAuth(choices);

    // Step 6 – set up shadcn/ui (if selected)
    await setupShadcn(choices);

    // Step 7 – (future steps go here)
    // e.g. await setupStateManagement(choices);
    //      await setupApi(choices);
    //      ...
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
