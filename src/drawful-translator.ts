#!/usr/bin/env ts-node

import { parallelLimit as _parallelLimit } from "async";
import { glob } from "glob";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import readline from "node:readline/promises";

import murmurhash from "murmurhash";
import path from "node:path";
import util from "node:util";
import yargs from "yargs";
import { text } from "stream/consumers";

const argv = yargs
  .scriptName("drawful-translator")
  .usage("<cmd>")
  .command("extract", "creates translatable file", {})
  .command("build", "rebuilds translated jet files")
  .demandCommand()
  .help().argv;

const command: "extract" | "build" = argv["_"][0];
const extract = command == "extract";
const build = command == "build";

const parallelLimit = util.promisify(_parallelLimit);

/**
 * creates a tab separated file with all the translatable texts
 */
const main = async function () {
  const INPUT_DIR = "./original";
  const JET_FILES_GLOB = "**/*.jet";
  const OUTPUT_DIR = "./output/extract/";
  const TEXTS_FILE =
    "original_texts_" + new Date().toISOString().substring(0, 10) + ".tsv";
  const TRANSLATED_TEXTS_FILE =
    "translated_texts_" + new Date().toISOString().substring(0, 10) + ".tsv";
  const jetFiles = await glob(path.join(INPUT_DIR, JET_FILES_GLOB));

  const textsToTranslate: Record<string, string> = {};

  if (build) {
    await new Promise((res) => {
      // reads translated texts file and fill textsToTranslate
      const rl = readline.createInterface({
        input: createReadStream(
          path.resolve(OUTPUT_DIR, TRANSLATED_TEXTS_FILE),
          {
            encoding: "utf8",
          }
        ),
        terminal: false,
      });
      rl.on("line", (line) => {
        const [textKey, textValue] = line.split("\t");
        textsToTranslate[textKey] = textValue;
      });
      rl.on("close", () => res(true));
    });
  }

  const processItem = function (item, key) {
    const textValue: string = item[key];
    const textKey = murmurhash(textValue).toString();

    if (textValue) {
      if (extract) {
        textsToTranslate[textKey] = textValue;
        // item[key] = textKey;
      }
      if (build) {
        const translatedText = textsToTranslate[textKey];
        if (!translatedText) {
          console.log();
          throw new Error("TRANSLATED TEXT NOT FOUND: " + textKey);
        }
        item[key] = translatedText;
      }
    }
  };

  const processFile = async function (inputFile: string) {
    console.log("reading " + inputFile);
    const fileTxt = await readFile(inputFile, { encoding: "utf-8" });
    const contents = JSON.parse(fileTxt);
    if (contents.content) {
      contents.content.forEach((i) => processItem(i, "category"));
    }
    if (contents.fields) {
      contents.fields
        .filter((f) => ["QuestionText", "AlternateSpellings"].includes(f.n))
        .forEach((i) => processItem(i, "v"));
    }

    if (build) {
      const relativePath = path.relative(INPUT_DIR, inputFile);
      const outputFile = path.resolve(OUTPUT_DIR, relativePath);
      const outputFileDir = path.join(outputFile, "/..");
      await mkdir(outputFileDir, { recursive: true });
      await writeFile(outputFile, JSON.stringify(contents), {
        encoding: "utf8",
      });
    }
  };

  await parallelLimit(
    jetFiles.map(
      (file) =>
        function (callback) {
          processFile(file).then((s) => callback(null, s));
        }
    ),
    1
  );

  if (extract) {
    // writes file with original texts
    await writeFile(
      path.resolve(OUTPUT_DIR, TEXTS_FILE),
      Object.entries(textsToTranslate)
        .map((e) => [e[0], e[1]].join("\t"))
        .join("\n"),
      { encoding: "utf8" }
    );

    // writes file only with hash keys
    await writeFile(
      path.resolve(OUTPUT_DIR, TRANSLATED_TEXTS_FILE),
      Object.entries(textsToTranslate)
        .map((e) => [e[0], ""].join("\t"))
        .join("\n"),
      { encoding: "utf8" }
    );
  }
};

main().catch((err) => {
  process.exit(1);
});
