import { Octokit } from '@octokit/rest';
// Debug function to log environment variables (without sensitive data)
function logEnvironment() {
    console.log('\n🔍 Environment Variables:');
    console.log(`- GITHUB_REPO_OWNER: ${process.env.GITHUB_REPO_OWNER || 'Not set'}`);
    console.log(`- GITHUB_REPO_NAME: ${process.env.GITHUB_REPO_NAME || 'Not set'}`);
    console.log(`- GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '*** (set)' : 'Not set'}`);
    console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}\n`);
}
async function testWorkflow() {
    // Log environment first
    logEnvironment();
    // Initialize Octokit with GitHub token
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
        log: console,
        request: {
            timeout: 10000
        }
    });
    const owner = process.env.GITHUB_REPO_OWNER || 'bilgisen';
    const repo = process.env.GITHUB_REPO_NAME || 'clerk';
    const workflowId = 'process-content.yml';
    const contentId = `test-${Date.now()}`;
    console.log('🔍 Repository Info:');
    console.log(`- Owner: ${owner}`);
    console.log(`- Repo: ${repo}`);
    console.log(`- Workflow: ${workflowId}`);
    console.log(`- Content ID: ${contentId}\n`);
    console.log('🚀 Starting workflow test...');
    console.log(`🔗 Repository: ${owner}/${repo}`);
    console.log(`📝 Content ID: ${contentId}`);
    try {
        // Trigger workflow
        console.log('🚀 Attempting to trigger workflow...');
        // First, verify repository access
        try {
            console.log('🔍 Verifying repository access...');
            const { data: repoData } = await octokit.repos.get({
                owner,
                repo,
            });
            console.log(`✅ Repository found: ${repoData.full_name}`);
            console.log(`   Default branch: ${repoData.default_branch}`);
            // Check workflow file exists
            console.log('🔍 Checking workflow file...');
            await octokit.repos.getContent({
                owner,
                repo,
                path: '.github/workflows/process-content.yml',
            });
            console.log('✅ Workflow file exists');
        }
        catch (error) {
            console.error('❌ Error accessing repository or workflow:');
            if (error.status === 404) {
                console.error('   Repository or workflow file not found');
            }
            else if (error.status === 403) {
                console.error('   Permission denied. Please check your token permissions.');
                console.error('   Required permissions: actions:write, contents:read');
            }
            else {
                console.error('   Unexpected error:', error.message || error);
            }
            process.exit(1);
        }
        // Trigger workflow
        console.log('\n🚀 Triggering workflow...');
        await octokit.actions.createWorkflowDispatch({
            owner,
            repo,
            workflow_id: workflowId,
            ref: 'main',
            inputs: {
                content_id: contentId,
                format: 'pdf',
                metadata: JSON.stringify({
                    title: 'Test Document',
                    author: 'Test User',
                    date: new Date().toISOString()
                })
            },
        });
        console.log('✅ Workflow triggered successfully!');
        // Get the latest workflow run with more details
        const { data: runs } = await octokit.actions.listWorkflowRuns({
            owner,
            repo,
            workflow_id: workflowId,
            event: 'workflow_dispatch',
            per_page: 1
        });
        const latestRun = runs.workflow_runs[0];
        const runId = latestRun.id;
        console.log(`🔍 Workflow run ID: ${runId}`);
        console.log(`🔗 View run: https://github.com/${owner}/${repo}/actions/runs/${runId}`);
        // Get the workflow run details
        const { data: runDetails } = await octokit.actions.getWorkflowRun({
            owner,
            repo,
            run_id: runId
        });
        console.log(`\n📊 Workflow Status: ${runDetails.status}`);
        console.log(`🏁 Conclusion: ${runDetails.conclusion || 'pending'}`);
        // Get workflow run jobs
        try {
            const { data: jobs } = await octokit.actions.listJobsForWorkflowRun({
                owner,
                repo,
                run_id: runId
            });
            console.log('\n🔧 Jobs:');
            jobs.jobs.forEach((job) => {
                console.log(`- ${job.name}: ${job.status} (${job.conclusion || 'in progress'})`);
                if (job.conclusion === 'failure') {
                    console.log(`  ❌ Failed step: ${job.steps?.find((s) => s.conclusion === 'failure')?.name || 'Unknown'}`);
                }
            });
        }
        catch (error) {
            console.error('\n⚠️ Could not fetch job details:', error.message || 'Unknown error');
        }
        console.log(`🔍 Workflow run ID: ${runId}`);
        // Poll for workflow completion
        let status = latestRun.status;
        let conclusion = latestRun.conclusion || null;
        while (status !== 'completed') {
            const { data: runs } = await octokit.actions.listWorkflowRuns({
                owner,
                repo,
                workflow_id: workflowId,
                event: 'workflow_dispatch',
                per_page: 1
            });
            const latestRun = runs.workflow_runs[0];
            status = latestRun.status;
            conclusion = latestRun.conclusion;
            console.log(`⏳ Workflow status: ${status} (${conclusion || 'in progress'})`);
            if (status === 'completed')
                break;
            // Wait 10 seconds before checking again
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
        if (conclusion === 'success') {
            console.log('🎉 Workflow completed successfully!');
            // Get workflow run artifacts
            const { data: artifacts } = await octokit.actions.listWorkflowRunArtifacts({
                owner,
                repo,
                run_id: runId,
            });
            if (artifacts.total_count > 0) {
                console.log('📦 Artifacts generated:');
                artifacts.artifacts.forEach(artifact => {
                    console.log(`   - ${artifact.name} (${artifact.size_in_bytes} bytes)`);
                    console.log(`     Download: ${artifact.archive_download_url}`);
                });
            }
            else {
                console.log('ℹ️ No artifacts were generated');
            }
        }
        else {
            console.error('❌ Workflow failed or was cancelled');
        }
    }
    catch (error) {
        console.error('❌ Error triggering workflow:');
        console.error(error);
        process.exit(1);
    }
}
testWorkflow();
