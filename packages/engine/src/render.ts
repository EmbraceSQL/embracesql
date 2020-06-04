import { InternalContext } from "./context";
import walk from "ignore-walk";
import path from "path";
import readFile from "read-file-utf8";
import frontMatter from "front-matter";
import handlebars from "handlebars";
import prettier from "prettier";
import fs from "fs-extra";

/**
 * Code generation is via handlebars, so we take the config, load up all the
 * sql, parse it for metadata, then generate some code.
 *
 * Up here -- setting up handlebars with some helpers.
 */

/**
 * Map iteration, lots of maps in our metadata and handlebars is
 * sadly lacking a built in.
 */
handlebars.registerHelper("eachInMap", (map, block) => {
  let out = "";
  Object.keys(map).map(function (prop, index, all) {
    out += block.fn(
      {
        value: map[prop],
      },
      {
        data: {
          index: index,
          key: prop,
          first: index === 0,
          last: index === all.length - 1,
        },
      }
    );
  });
  return out;
});

/**
 * Tree-ify a path compressed map.
 */
handlebars.registerHelper("treeAMap", (map, block) => {
  let out = "";
  const result = [];
  const level = { result };

  Object.keys(map).forEach((path) => {
    path.split("/").reduce((r, name, i, a) => {
      // link back to the full path
      const value = a.length - 1 === i ? map[a.join("/")] : undefined;
      if (!r[name]) {
        r[name] = { result: [] };
        r.result.push({
          name,
          children: r[name].result,
          value,
          path: a.join("/"),
        });
      }

      return r[name];
    }, level);
  });

  out += block.fn(
    {
      value: result,
    },
    {
      // pass on variable
      data: block.hash,
    }
  );
  return out;
});

/**
 * Content to be written to a file.
 */
export type ToFile = {
  /**
   * Fully qualified path, write the file here.
   */
  fileName: string;
  /**
   * Fill in the file with this content.
   */
  content: string;
};

/**
 * Inspired almost exactly by hygen, but in process, and with handlebars as it is
 * more popular.
 *
 * Works on a directory of templates, which are handlebars with front matter.
 *
 * Front matter values are themselves handlebars templates.
 *
 * The only required front matter value is `to`, which turns into the target file
 * location. Other named values are added to the context before being passed to render
 * the body.
 *
 * @param rootContext - render off a root context, not a runtime context, as no API is being called
 * @param templatesInDirectory - read every template in this directory, honoring .ignore files
 *
 * @returns - a promise of the named files -- but this function doesn't do the writing
 */
export const renderTemplates = async (
  rootContext: InternalContext,
  templatesInDirectory: string
): Promise<Array<ToFile>> => {
  // set up our partials that are actual code -- not really even handlebars
  // this is a bit of a trick to allow creating as much code for the templating
  // as possible as just plain code with syntax highlighting and autocomplete
  // generated code takes these as a starting point and adds on generated types
  const waitForCodePartials = [
    "shared-context.ts",
    "shared-browser-client.ts",
    "shared-node-client.ts",
  ].map(
    async (fileName): Promise<void> => {
      const fileContent = await readFile(path.join(__dirname, fileName));
      handlebars.registerPartial(fileName, handlebars.compile(fileContent));
    }
  );
  await Promise.all(waitForCodePartials);
  // ok -- these are actual good old fashioned partials -- put shared templates
  // you need in `templates/partials` and they will be registered by name for you
  // as "partials/<filename>"
  const partials = await fs.readdir(
    path.join(__dirname, "templates", "partials")
  );
  const waitForPartials = partials.map(
    async (fileName): Promise<void> => {
      const fileContent = await readFile(
        path.join(__dirname, "templates", "partials", fileName)
      );
      handlebars.registerPartial(
        `partials/${fileName}`,
        handlebars.compile(fileContent)
      );
    }
  );
  await Promise.all(waitForPartials);
  return (
    walk({ path: templatesInDirectory })
      .then((fileNames) =>
        fileNames.map((fileName) => path.join(templatesInDirectory, fileName))
      )
      .then(async (templatePaths) => templatePaths.map(readFile))
      // the files themselves know their 'to' so we don't need to keep the file name
      // but might as well flatten out those promises
      .then((_) => Promise.all(_))
      // this is the 'rendering loop'
      .then((templates) =>
        templates.map((template) => {
          // pick out the front matter, this leaves us with variables and template
          const { attributes, body } = frontMatter(template);
          // render the front matter variables
          const frontMatterVariables = Object.entries(attributes).reduce(
            (obj, [key, value]) => {
              return {
                ...obj,
                [key]: handlebars.compile(value)(rootContext),
              };
            },
            {}
          );
          // render the actual template with the context extended
          // by the front matter variables
          const fileName = frontMatterVariables["to"];
          const beautifier = (content: string): string => {
            const extension = path.extname(fileName).toLowerCase();
            const prettierSupport = prettier.getSupportInfo();
            const parsers = prettierSupport.languages.flatMap((language) => {
              if (language.extensions?.find((e) => e === extension)) {
                return language.parsers;
              } else {
                return [];
              }
            });
            if (parsers.length) {
              return prettier.format(content, {
                parser: (parsers[0] as unknown) as prettier.CustomParser,
              });
            } else {
              return content;
            }
          };
          return {
            fileName,
            content: beautifier(
              handlebars.compile(body)(
                Object.assign({}, rootContext, frontMatterVariables)
              )
            ),
          };
        })
      )
  );
};
