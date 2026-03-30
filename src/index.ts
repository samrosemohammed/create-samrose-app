import { promptUser } from "./prompt.js";
import { setupNextjsProject } from "./setup-nextjs.js";
import { setupOrm } from "./setup-orm.js";

async function main() {
  try {
    // Step 1 – collect all user choices
    const choices = await promptUser();

    // Step 2 – scaffold the Next.js project
    await setupNextjsProject(choices);

    // Step 3 – set up the selected ORM
    await setupOrm(choices);

    // Step 4 – (future steps go here)
    // e.g. await setupAuth(choices);
    //      await setupStateManagement(choices);
    //      ...
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
