import {setFailed, getInput} from '@actions/core'
import {GitHub, context} from '@actions/github'
import {readResults, Annotation} from './nunit'

function generateSummary(annotation: Annotation): string {
  return `* ${annotation.title}\n   ${annotation.message}`
}

async function run(): Promise<void> {
  try {
    const path = getInput('path')
    const numFailures = parseInt(getInput('numFailures'))
    const accessToken = getInput('access-token')

    const results = await readResults(path)

    const octokit = new GitHub(accessToken)

    const summary =
      results.failed > 0
        ? `${results.failed} tests failed`
        : `${results.passed} tests passed`

    let details =
      results.failed === 0
        ? `** ${results.passed} tests passed**`
        : `
**${results.passed} tests passed**
**${results.failed} tests failed**
`

    for (const ann of results.annotations) {
      const annStr = generateSummary(ann)
      const newDetails = `${details}\n${annStr}`
      if (newDetails.length > 65000) {
        details = `${details}\n\n ... and more.`
        break
      } else {
        details = newDetails
      }
    }

    console.log(`sending request for sha ${context.sha} ...`)
    const result = await octokit.checks.create({
      head_sha: context.sha,
      name: 'Tests Results',
      owner: context.repo.owner,
      repo: context.repo.repo,
      status: 'completed',
      conclusion: results.failed > 0 ? 'failure' : 'success',
      output: {
        title: 'Test Results',
        summary,
        annotations: results.annotations.slice(0, numFailures),
        text: details
      }
    })
    console.dir(result.status)
    console.dir(result.data)
  } catch (error) {
    setFailed(error.message)
  }

  console.log('ok!')
}

run()
