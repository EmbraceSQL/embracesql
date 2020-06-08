// this is our actual embedded database.
import { EmbraceSQLEmbedded } from "databases";

const main = async () => {
  const embedded = await EmbraceSQLEmbedded();
  console.log(await embedded.databases.default.hello({}));
};
main();
