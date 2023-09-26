# SQLTools Vertica Driver

[Vertica](https://www.vertica.com/) driver for [VS Code SQLTools](https://vscode-sqltools.mteixeira.dev/).

This driver supports connect to Vertica use [vertica-nodejs](https://github.com/vertica/vertica-nodejs) driver to browse and execute queries to the database

## Installation

Install the driver from the VS Code Marketplace page.

## Setup Development Environment

make sure TypeScript is installed properly `npm install -g typescript`, goto the root dir of this project, run `npm install` then it should install all the dependencies.
then run `tsc` to compile the project.

Go to file `src\ls\driver.ts`, click Run -> Start Debugging -> choose VS Code Extension Development, it should pop an new windows for testing. Click View -> Output -> choose SQLTools, it should display outputs of `console.log()` and other logs.

## License
* See [LICENSE](LICENSE)