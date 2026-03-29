import { promptUser } from "./prompt.js";

const promptUserResult = await promptUser();
console.log("User choices:", promptUserResult);
