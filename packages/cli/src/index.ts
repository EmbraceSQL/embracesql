import { program } from "commander";
import pj from "../package.json";
import init from "./init";
import start from "./start";
import migrate from "./migrate";
import embedded from "./embedded";
import { install } from "@embracesql/console";

/**
 * Our little command line interface. This can be used from Docker -- which is the
 * intended use, or with `yarn cli` for development and testing.
 */
const main = async (): Promise<void> => {
  install();
  program.version(pj.version);
  program.description(`Command line interface to EmbraceSQL.`);
  program.addCommand(init);
  program.addCommand(start);
  program.addCommand(migrate);
  program.addCommand(embedded);
  // GO!
  await program.parseAsync(process.argv);
};
main();
