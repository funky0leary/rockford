const glob = require('glob-fs')({gitignore: true})
const fs = require('fs')
const esprima = require('esprima')
const estraverse = require('estraverse')
const defaultConfig = require('./default-config')
const reporter = require('./reporter')

const overallCoverage = {
  functionCount: 0,
  dbcAssertions: 0,
  reportData: []
}

/**
 * Rockford - Runs a code analysis on a set of JS files to determine the DbC code coverage
 * based on simple-assertion
 */
function rockford () {
  // read the config file for options
  const config = getConfig()

  glob.readdirStream(config.glob, {})
    .on('data', (file) => recordFileCoverage(file))
    .on('end', () => calculateCoverage())
}

/**
 * Sets Rockford's configuration
 */
function getConfig () {
  return getConfigFromArgs() || defaultConfig
}

/**
 * Gets the name of a config file from the command line args
 * @returns {*|null}
 */
function getConfigFromArgs () {
  const configFileName = process.argv[2] || '.rockford-file'
  const configFile = fs.readFileSync(configFileName, 'utf8')
  return configFileName ? JSON.parse(configFile) : null
}

/**
 * Records DbC coverage for a file
 * @param file
 */
function recordFileCoverage (file) {
  console.log('Processing', file.relative)
  const ast = parseJsFile(getJsFiles(file.path))
  const baseAssertionCount = overallCoverage.dbcAssertions
  const baseFunctionCount = overallCoverage.functionCount
  estraverse.traverse(ast, {
    enter: function (node) {
      recordFunctions(node)
      recordDbcAssertions(node)
    }
  })
  const fileCoverage = getFileCoverage(baseAssertionCount, baseFunctionCount, overallCoverage)
  overallCoverage.reportData.push([file.relative, fileCoverage, fileCoverage > .8 ? 'Sane' : 'Needs Help!'])
}

/**
 * Calculates the coverage for an individual file
 * @param baseDbcAssertions
 * @param baseFunctionCount
 * @param overallCoverage
 */
function getFileCoverage(baseDbcAssertions, baseFunctionCount, overallCoverage) {
  const assertions = Math.abs(overallCoverage.dbcAssertions - baseDbcAssertions)
  const functions = Math.abs(overallCoverage.functionCount - baseFunctionCount)
  return (assertions /2) / functions
}

/**
 * Calculates the code coverage
 */
function calculateCoverage () {
  const totalCoverage = (overallCoverage.dbcAssertions / 2) / overallCoverage.functionCount
  overallCoverage.reportData.push(['Total', totalCoverage, totalCoverage > .8 ? 'Sane' : 'Needs Help!'])
  reporter(overallCoverage.reportData)
}

/**
 * Records the number of DbC assertions in the set of files
 * @param node
 */
function recordDbcAssertions (node) {
  if (node.type === 'ExpressionStatement') {
    let calleeName = node.expression.callee.name
    if (calleeName === 'pre' || calleeName === 'post') {
      overallCoverage.dbcAssertions++
    }
  }
}

/**
 * Records the number of functions in the set of files
 * @param node
 */
function recordFunctions (node) {
  if (node.type === 'FunctionDeclaration') {
    overallCoverage.functionCount++
  }
}

/**
 * Gets a file and returns its string representation
 * @param filename
 * @return {*}
 */
function getJsFiles (filename) {
  return fs.readFileSync(filename, 'utf8')
}

/**
 * Parses the file into an AST string
 * @param file
 * @return {*}
 */
function parseJsFile (file) {
  return esprima.parse(file)
}

rockford()