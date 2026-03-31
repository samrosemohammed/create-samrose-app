import { promptUser } from "./prompt.js";
import { setupNextjsProject } from "./setup-nextjs.js";

async function main() {
  try {
    // Step 1 – collect all user choices
    const choices = await promptUser();

    // Step 2 – scaffold the Next.js project
    await setupNextjsProject(choices);

    // Step 3 – (future steps go here)
    // e.g. await setupOrm(choices);
    //      await setupAuth(choices);
    //      await setupStateManagement(choices);
    //      ...
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
