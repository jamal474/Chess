export const aichatTemplate = `
<!-- Popup : AI Chat Box -->
  <div id="popup-aichat" class="modal">
    <div class="chatBox">
      <span class="closeAiChat" style="font-size: 50px;">&times;</span>
      <div class="chatHeader">
        <h2>ConvAI chat</h2>
        <Button class="resetAiChat" onclick="reset()">Reset</Button>
      </div>
      <div class="chatAi">
        <div class="messages">
          <div class="message-list">
            <div class="message-item item-primary">
              Hi, How Can I help you.
            </div>
          </div>
          <div class="message-input">
            <div class="microphone">
              <Button onclick="talky()">
                <!-- <FontAwesomeIcon icon={this.talkMsg == "Talk" ? faMicrophoneSlash : faMicrophone} />} -->
                <i class="microphoneSlashed fa-solid fa-microphone-slash"></i>
                <i class="microphoneOpen fa-solid fa-microphone" style="display: none"></i>
              </Button>
            </div>
            <input placeholder="chat with ai" class="inputAi" onchange="handleMsgChange()" />
            <div>
              <Button onclick="sendMsg()">
                <i class="fa-solid fa-paper-plane"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;