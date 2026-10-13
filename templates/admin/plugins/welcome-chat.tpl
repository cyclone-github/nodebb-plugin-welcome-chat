<div class="acp-page-container">
  <!-- IMPORT admin/partials/settings/header.tpl -->
  <div class="row m-0">
    <div id="spy-container" class="col-12 col-md-9 px-0 mb-4" tabindex="0">
      <form role="form" class="welcome-chat-settings">
        <div class="mb-4">
          <h5 class="fw-bold tracking-tight settings-header">Automatic welcome chats</h5>
          <p>Send new members a private welcome message with your forum team.</p>
          <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="enabled" name="enabled">
            <label class="form-check-label" for="enabled">Enable automatic welcome chats</label>
          </div>
          <div class="mb-3">
            <label class="form-label" for="deliveryMode">Send welcome DM</label>
            <select class="form-select" id="deliveryMode" name="deliveryMode">
              <option value="created">When account is created</option>
              <option value="approved">After admin approval (when required)</option>
              <option value="verified">After email verification</option>
              <option value="approved_verified" selected>After both approval and email verification (default)</option>
            </select>
            <p class="form-text">For forums using account approval, messages go out after approval. Email verification must be completed before email-gated messages are sent. If your forum does not require email verification, choose a different option.</p>
          </div>
          <div class="mb-3">
            <label class="form-label" id="groupNamesLabel">Staff groups</label>
            <!-- Keep the existing settings key; old comma/newline values are supported. -->
            <input type="hidden" id="groupNames" name="groupNames" value="administrators,Global Moderators">
            <div id="staff-group-options" class="d-flex flex-wrap gap-2" role="group" aria-labelledby="groupNamesLabel">
              {{{ each staffGroups }}}
              <button type="button" class="btn btn-outline-secondary btn-sm welcome-chat-group" data-group-name="{staffGroups.name}" aria-pressed="false">{staffGroups.name}</button>
              {{{ end }}}
            </div>
            <p id="staff-group-warning" class="form-text text-danger d-none" role="alert">Select up to 10 groups.</p>
            <p class="form-text">Click a group to add it to the chat. Click it again to remove it. The list comes from your forum's existing groups.</p>
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
            <label class="form-label" for="rulesUrl">Forum rules URL (optional)</label>
            <input class="form-control" id="rulesUrl" name="rulesUrl" type="url" placeholder="https://example.org/rules">
            <p class="form-text">Optional. Add your own HTTPS rules URL and include <code>&#123;rulesUrl&#125;</code> in the message to link to it.</p>
          </div>
          <div class="mb-3">
            <label class="form-label" for="messageTemplate">Message body</label>
            <textarea class="form-control" id="messageTemplate" name="messageTemplate" rows="10">Hi &#123;username&#125;,

Welcome to &#123;forumName&#125;! We're glad you're here.

If you have any questions, feel free to reply to this chat.
Our team will be happy to help.

Thanks for joining!</textarea>
            <p class="form-text mb-1">Use these placeholders in the title or message:</p>
            <ul class="form-text mt-0 mb-2">
              <li><code>&#123;username&#125;</code> - the new member's username</li>
              <li><code>&#123;forumName&#125;</code> - your forum's name</li>
              <li><code>&#123;rulesUrl&#125;</code> - the rules link you entered above</li>
            </ul>
            <p class="form-text">Example: <code>Hi &#123;username&#125;! Welcome to &#123;forumName&#125;.</code> To include a rules link, enter a URL above and add <code>Forum rules: &#123;rulesUrl&#125;</code> to the message.</p>
          </div>
        </div>
      </form>
    </div>
  </div>
</div>
