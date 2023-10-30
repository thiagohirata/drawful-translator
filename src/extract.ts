#!/usr/bin/env ts-node

import { parallelLimit as _parallelLimit } from "async";
import { glob } from "glob";
import { readFile, writeFile, stat, mkdir } from "node:fs/promises";
import murmurhash from "murmurhash";
import path from "node:path";
import util from "node:util";
const parallelLimit = util.promisify(_parallelLimit);

/**
 *
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

  const processItem = function (item, key) {
    let textValue: string = item[key];

    if (textValue.indexOf("<RANDOM_PLAYER_NAME>") >= 0) {
      textValue = textValue.replace(
        "<RANDOM_PLAYER_NAME>",
        "#RANDOM_PLAYER_NAME"
      );
    }
    if (textValue) {
      if (!textsToTranslate[textValue]) {
        const textKey = murmurhash(textValue).toString();
        textsToTranslate[textValue] = textKey;
        item[key] = textKey;
      } else {
        item[key] = textsToTranslate[textValue];
      }
    }
  };

  const extractFile = async function (inputFile: string) {
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

    const relativePath = path.relative(INPUT_DIR, inputFile);
    const outputFile = path.resolve(OUTPUT_DIR, relativePath);
    const outputFileDir = path.join(outputFile, "/..");
    console.log("making dir " + outputFileDir);
    await mkdir(outputFileDir, { recursive: true });
    console.log("writing to " + outputFile);
    await writeFile(outputFile, JSON.stringify(contents), { encoding: "utf8" });
  };

  await parallelLimit(
    jetFiles.map(
      (file) =>
        function (callback) {
          extractFile(file).then((s) => callback(null, s));
        }
    ),
    1
  );

  // writes file with original texts
  await writeFile(
    path.resolve(OUTPUT_DIR, TEXTS_FILE),
    Object.entries(textsToTranslate)
      .map((e) => [e[1], e[0]].join("\t"))
      .join("\n"),
    { encoding: "utf8" }
  );

  // writes file only with hash keys
  await writeFile(
    path.resolve(OUTPUT_DIR, TRANSLATED_TEXTS_FILE),
    Object.entries(textsToTranslate)
      .map((e) => [e[1], ""].join("\t"))
      .join("\n"),
    { encoding: "utf8" }
  );
};

main().catch((err) => {
  process.exit(1);
});
