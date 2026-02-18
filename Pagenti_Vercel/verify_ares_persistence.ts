import { aresService } from './services/aresService';
import { AresProposal } from './types';

async function verifyPersistence() {
    console.log("🧪 Verifying ARES Persistence...");

    const testProposal: AresProposal = {
        id: `test-prop-${Date.now()}`,
        type: 'HOTFIX',
        severity: 'LOW',
        timestamp: new Date().toISOString(),
        title: 'Verification Test Proposal',
        description: 'Testing persistence across Vercel rebuild simulation',
        rationale: 'Verification',
        affected_component: 'TestComponent',
        estimated_impact: {
            risk_level: 'LOW',
            rollback_plan: 'None'
        },
        status: 'PENDING',
        approval_required: false,
        auto_deploy_allowed: false,
        created_by: 'ARES'
    };

    console.log("Saving proposal...");
    await aresService.saveProposal(testProposal);

    console.log("Retrieving proposals...");
    const proposals = await aresService.getProposals(true);
    const found = proposals.find(p => p.id === testProposal.id);

    if (found) {
        console.log("✅ Proposal persisted and retrieved successfully!");
    } else {
        console.error("❌ Proposal not found in Firestore!");
    }

    console.log("Updating status...");
    await aresService.updateProposalStatus(testProposal.id, 'APPROVED');

    const updatedProposals = await aresService.getProposals(true);
    const updatedFound = updatedProposals.find(p => p.id === testProposal.id);

    if (updatedFound?.status === 'APPROVED') {
        console.log("✅ Status update persisted!");
    } else {
        console.error("❌ Status update failed!");
    }

    process.exit(0);
}

verifyPersistence();
