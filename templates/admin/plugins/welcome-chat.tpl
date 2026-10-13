<div class="acp-page-container">
  <!-- IMPORT admin/partials/settings/header.tpl -->
  <div class="row m-0">
    <div id="spy-container" class="col-12 col-md-9 px-0 mb-4" tabindex="0">
      <form role="form" class="welcome-chat-settings">
        <div class="mb-4">
          <h5 class="fw-bold tracking-tight settings-header">Automatic welcome chats</h5>
          <p>Creates one private chat for each newly created account, including the current members of the selected staff groups. Disabled until enabled and saved below.</p>
          <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="enabled" name="enabled">
            <label class="form-check-label" for="enabled">Enable automatic welcome chats</label>
          </div>
          <div class="mb-3">
            <label class="form-label" for="deliveryMode">Send welcome DM</label>
            <select class="form-select" id="deliveryMode" name="deliveryMode">
              <option value="created" selected>When account is created (default)</option>
              <option value="approved">After admin approval (when required)</option>
              <option value="verified">After email verification</option>
              <option value="approved_verified">After both approval and email verification</option>
            </select>
            <p class="form-text">Recommended: after both. NodeBB creates accounts in its registration approval queue only after an administrator accepts them; unqueued registrations are automatically eligible for the approval condition. Email-gated options wait for NodeBB's email-confirmed status, including manual confirmation by an admin. If email verification is disabled, email-gated welcomes will remain pending until verified.</p>
          </div>
          <div class="mb-3">
            <label class="form-label" for="groupNames">Staff groups (one per line)</label>
            <textarea class="form-control" id="groupNames" name="groupNames" rows="3">administrators
Global Moderators</textarea>
            <p class="form-text">The built-in <code>Global Moderators</code> group does not automatically include category-only moderators. You can add custom staff groups here.</p>
          </div>
          <div class="mb-3">
            <label class="form-label" for="extraUids">Additional staff user IDs (optional)</label>
            <input class="form-control" id="extraUids" name="extraUids" placeholder="12, 35">
            <p class="form-text">Additional specific accounts to include, separated by commas or spaces.</p>
          </div>
          <div class="mb-3">
            <label class="form-label" for="senderUid">Sender user ID (optional)</label>
            <input class="form-control" id="senderUid" name="senderUid" type="number" min="1" step="1" placeholder="1">
            <p class="form-text">Must be a selected staff member. Otherwise, the lowest-numbered admin UID is used, followed by another staff member.</p>
          </div>
        </div>
        <div class="mb-4">
          <h5 class="fw-bold tracking-tight settings-header">Welcome message</h5>
          <div class="mb-3">
            <label class="form-label" for="roomTitle">Chat title</label>
            <input class="form-control" id="roomTitle" name="roomTitle" value="Welcome to &#123;forumName&#125;">
          </div>
          <div class="mb-3">
            <label class="form-label" for="rulesUrl">Forum rules URL</label>
            <input class="form-control" id="rulesUrl" name="rulesUrl" type="url" placeholder="https://example.org/rules">
            <p class="form-text">Optional. Add your own HTTPS rules URL and include <code>&#123;rulesUrl&#125;</code> in the message to link to it.</p>
          </div>
          <div class="mb-3">
            <label class="form-label" for="messageTemplate">Message body</label>
            <textarea class="form-control" id="messageTemplate" name="messageTemplate" rows="10">Welcome to &#123;forumName&#125;, &#123;username&#125;!

Thanks for joining our community.

This private chat includes members of the forum team. If you have questions,
you can reply here when your account has permission to send chats.

We look forward to seeing you around!</textarea>
            <p class="form-text">Message and chat title support <code>&#123;username&#125;</code>, <code>&#123;forumName&#125;</code> and <code>&#123;rulesUrl&#125;</code>. Only use <code>&#123;rulesUrl&#125;</code> after configuring a rules URL. Subject to NodeBB's chat message length limit.</p>
          </div>
          <div class="alert alert-info">Staff membership is resolved when a user registers. Existing private chat memberships do not change automatically when staff groups change.</div>
        </div>
      </form>
    </div>
  </div>
</div>
