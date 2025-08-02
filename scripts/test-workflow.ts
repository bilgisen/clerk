import { Octokit } from '@octokit/rest';

async function testWorkflow() {
  // Initialize Octokit with GitHub token
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  const owner = process.env.GITHUB_REPO_OWNER || 'bilgisen';
  const repo = process.env.GITHUB_REPO_NAME || 'clerk';
  const workflowId = 'process-content.yml';
  const contentId = `test-${Date.now()}`;
  
  console.log('🚀 Starting workflow test...');
  console.log(`🔗 Repository: ${owner}/${repo}`);
  console.log(`📝 Content ID: ${contentId}`);

  try {
    // Trigger workflow
    // Trigger workflow - createWorkflowDispatch doesn't return a run ID directly
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
    
    // Get the latest workflow run
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
      
      if (status === 'completed') break;
      
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
      } else {
        console.log('ℹ️ No artifacts were generated');
      }
    } else {
      console.error('❌ Workflow failed or was cancelled');
    }
    
  } catch (error) {
    console.error('❌ Error triggering workflow:');
    console.error(error);
    process.exit(1);
  }
}

testWorkflow();
