# Drawful 2 Translator

## Step 0 - Setup

- Clone the repository.
- Install Node.js version 18.x or newer.
- Install Yarn and execute yarn install.

## Step 1 - Copy Content Files

Copy the files from the original game located in `steamapps\common\Drawful2\content\en` to the original directory within this project.

## Step 2 - Extract Texts Using the Tool

Execute the command: yarn ts-node ./src/drawful-translator.ts extract.

## Step 3 - Translate the Texts

- Create an Xlsx file
- Paste the contents from `output/extract/original_texts.tsv` into the sheet.
- Use Google Translator to translate the file: https://translate.google.com/?hl=en&tab=TT&sl=en&tl=br&op=docs
- Paste the translated texts into `output/extract/translated_texts_?.tsv`

## Step 4 - Generate translated files

Run the command: `yarn ts-node ./src/drawful-translator.ts build`

The translated files will be written to `output/extract/Drawful2/content/en`

## Step 5 - Replace the Original Files (Ensure to Backup the Originals First!)
