-- Phase 12: Orientation and ROE draft content
-- Developed from TSE network handbook structure.
-- Both versions are marked is_test = true and is_active = false.
-- DO NOT activate without explicit founder approval.
-- The founder supplies final language; these drafts are structural scaffolding.

-- =============================================================================
-- 1. Staff Orientation — Draft v2
-- =============================================================================

INSERT INTO orientation_content (version, title, body_html, is_active, is_test)
VALUES (
  'v2-draft',
  '[DRAFT] Staff Orientation — Pending Founder Approval',
  '<div class="orientation-content">

  <p style="background:#FEF9C3;border-left:4px solid #CA8A04;padding:0.75rem 1rem;border-radius:4px;font-size:0.875rem;">
    <strong>[TEST — DRAFT]</strong> This content has not been approved for publication.
    Final language will be supplied by the founder before activation.
  </p>

  <h2>Welcome to the Lattice Network</h2>

  <p>Lattice is The Seed Exchange's (TSE) coordinated service network for social-service and community-benefit organizations
  operating in Georgia. As a staff member of a Lattice member organization, you are now part of a trusted ecosystem
  designed to help people access the services they need — faster and with less friction.</p>

  <p>This orientation covers your responsibilities and the norms that keep the network functioning well for every
  organization and every person it serves.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />

  <h3>1. How the Network Works</h3>

  <p>Member organizations list the services they offer. When a person needs a service your organization provides,
  another member organization can submit a coordination request through Lattice. You are responsible for receiving,
  acknowledging, and resolving those requests within the timeframes your organization has committed to.</p>

  <ul>
    <li><strong>Incoming requests</strong> appear on your organization's Dashboard the moment they are submitted.</li>
    <li>Your organization's Point of Contact (POC) assigns requests to staff and marks outcomes.</li>
    <li>Requests remain open until they are resolved or your organization marks itself unable to assist.</li>
  </ul>

  <h3>2. Response Standards</h3>

  <p>Timely responses are the foundation of network trust. Your organization's tier determines the acknowledgement
  window; regardless of tier, every open request must receive a substantive response — not simply an acknowledgement —
  within a reasonable timeframe. TSE monitors inactivity and may flag requests that go unaddressed.</p>

  <ul>
    <li>Acknowledge every new request within your organization's committed window.</li>
    <li>Respond within the platform whenever possible so the requesting organization has a record.</li>
    <li>If you cannot assist, mark the request accordingly with an honest category and note — this data helps TSE
    understand service gaps across the network.</li>
  </ul>

  <h3>3. Confidentiality</h3>

  <p>Coordination requests may include sensitive information about the people seeking services.
  This information is shared in confidence between member organizations for the sole purpose of connecting
  that person to services. You may not:</p>

  <ul>
    <li>Share request details outside the coordination workflow.</li>
    <li>Store identifiable client information in free-text fields visible to other network members.</li>
    <li>Use request information for any purpose other than determining whether your organization can assist.</li>
  </ul>

  <p>TSE does not store HMIS or case-management data in Lattice. Do not enter case numbers, treatment details,
  or identifiers beyond what is strictly necessary to route the request.</p>

  <h3>4. Your Role and Your POC</h3>

  <p>Every member organization has a designated Point of Contact (POC) who is accountable to TSE for the
  organization's participation. As a staff member:</p>

  <ul>
    <li>You respond to requests assigned to you by your POC.</li>
    <li>You may invite collaborating providers into a request with your POC's awareness.</li>
    <li>Decisions about whether your organization can assist with a given request rest with your POC.</li>
    <li>If you have a concern about a request (inappropriate content, safety issues), use the flag function
    to escalate it to TSE — do not attempt to handle it unilaterally.</li>
  </ul>

  <h3>5. Keeping Your Listing Current</h3>

  <p>The network is only as useful as the information in it. You are responsible for ensuring your
  organization's service listing accurately reflects what you currently offer, including service areas,
  eligibility requirements, and capacity constraints. Outdated listings waste other members' time and,
  more importantly, can misdirect people in need.</p>

  <h3>6. How to Get Help</h3>

  <p>If you encounter a technical issue, have a question about network norms, or need to escalate a concern,
  contact TSE at the address listed in your activation email. TSE staff review flagged requests and
  conduct a weekly review of network activity.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />

  <p style="font-size:0.875rem;color:#6b7280;">
    By completing this orientation you confirm that you have read and understood the above information and
    agree to participate in the Lattice network in accordance with these standards.
  </p>

  </div>',
  false,  -- not active until founder approves
  true    -- marked test/draft
)
ON CONFLICT (version) DO NOTHING;


-- =============================================================================
-- 2. Rules of Engagement — Draft v2
-- =============================================================================

INSERT INTO roe_content (version, title, body_html, is_active, is_test)
VALUES (
  'v2-draft',
  '[DRAFT] Rules of Engagement — Pending Founder Approval',
  '<div class="roe-content">

  <p style="background:#FEF9C3;border-left:4px solid #CA8A04;padding:0.75rem 1rem;border-radius:4px;font-size:0.875rem;">
    <strong>[TEST — DRAFT]</strong> This content has not been approved for publication.
    Final language will be supplied by the founder before activation.
  </p>

  <h2>Rules of Engagement</h2>
  <p style="color:#6b7280;font-size:0.9rem;">The Seed Exchange — Lattice Network | Effective date: [TO BE SET AT ACTIVATION]</p>

  <p>These Rules of Engagement ("Rules") govern the participation of your organization and its staff in the
  Lattice coordinated service network operated by The Seed Exchange ("TSE"). By acknowledging these Rules, you
  agree that your organization will participate in accordance with the standards below.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />

  <h3>1. Participation Standards</h3>

  <p><strong>1.1 Responsiveness.</strong> Your organization will acknowledge coordination requests received
  through Lattice within the timeframe associated with your membership tier, and will provide a substantive
  response — either confirming assistance or marking inability to assist — without unreasonable delay.
  Chronic non-responsiveness may result in account review.</p>

  <p><strong>1.2 Accuracy.</strong> Your organization will maintain an accurate and current service listing,
  including service types, geographic coverage, eligibility criteria, and contact information. You will update
  your listing promptly when circumstances change.</p>

  <p><strong>1.3 Good Faith.</strong> Your organization will engage with coordination requests in good faith,
  with the genuine intention of determining whether you can assist the person in need. The network exists to
  serve people, not to generate referral volume.</p>

  <h3>2. Confidentiality and Data Handling</h3>

  <p><strong>2.1 Client Information.</strong> Any information about an individual shared in a coordination
  request is confidential. You will not disclose that information outside the coordination workflow, store it
  in systems not covered by your organization's privacy practices, or use it for any purpose other than
  determining whether your organization can assist.</p>

  <p><strong>2.2 No HMIS Data.</strong> Lattice is not an HMIS-connected system. You will not enter HMIS
  identifiers, case numbers, treatment or diagnosis information, or other protected health information into
  any Lattice field.</p>

  <p><strong>2.3 Network Member Data.</strong> Contact and organizational information belonging to other
  member organizations is shared for the purpose of network coordination only. You will not use it for
  solicitation or any purpose unrelated to network participation.</p>

  <h3>3. Professional Conduct</h3>

  <p><strong>3.1 Respect.</strong> All communications through the platform will be professional, respectful,
  and focused on the coordination task at hand.</p>

  <p><strong>3.2 Flagging.</strong> If you encounter content in a coordination request that appears
  inappropriate, poses a safety concern, or otherwise requires TSE review, use the platform's flag function
  rather than taking unilateral action. TSE staff review all flagged content.</p>

  <p><strong>3.3 No Solicitation.</strong> The platform may not be used to solicit other member organizations
  for purposes unrelated to coordination (e.g., fundraising, vendor relationships, recruiting).</p>

  <h3>4. Role Boundaries</h3>

  <p><strong>4.1 Staff Responsibilities.</strong> Staff members respond to requests assigned by their
  organization's Point of Contact. Staff may invite collaborating providers into a request and may flag
  content for TSE review. Decisions about organizational capacity and inability to assist rest with the POC.</p>

  <p><strong>4.2 POC Responsibilities.</strong> The designated POC is accountable to TSE for the organization's
  compliance with these Rules. The POC assigns requests to staff, marks organizational outcomes (including
  inability to assist), and is the primary contact for TSE regarding the organization's participation.</p>

  <h3>5. Enforcement</h3>

  <p><strong>5.1 Violations.</strong> Violations of these Rules — including chronic non-responsiveness,
  misuse of confidential information, or conduct that degrades the network — may result in account suspension
  or removal from the Lattice network at TSE's discretion.</p>

  <p><strong>5.2 Notice.</strong> Where feasible, TSE will provide notice and an opportunity to cure before
  taking enforcement action, except in cases involving serious confidentiality breaches or safety concerns.</p>

  <p><strong>5.3 Appeals.</strong> An organization that believes an enforcement action was taken in error may
  request review by contacting TSE within 14 days of the action.</p>

  <h3>6. Changes to These Rules</h3>

  <p>TSE may update these Rules from time to time. When material changes are made, member organizations will
  be required to re-acknowledge the updated Rules before continuing to access the platform. Continued
  participation after re-acknowledgement constitutes agreement to the updated Rules.</p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:1.5rem 0;" />

  <p style="font-size:0.875rem;color:#6b7280;">
    By acknowledging these Rules you confirm that you are authorized to bind your organization to these
    commitments, and that your organization agrees to participate in the Lattice network in accordance with
    the standards above.
  </p>

  </div>',
  false,  -- not active until founder approves
  true    -- marked test/draft
)
ON CONFLICT (version) DO NOTHING;
