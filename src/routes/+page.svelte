<script lang="ts">
  import { onMount } from 'svelte';
  import { AppShell } from '@skeletonlabs/skeleton';

  let messages: { text: string; isUser: boolean }[] = [];
  let inputMessage = '';
  let chatContainer: HTMLElement;
  let isLoading = false;
  let conversationCount = 0;
  let isEndingChat = false;
  let endChatTimer: NodeJS.Timeout | null = null;

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (messages.length > 0) {
        handleEndChat();
      }
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (endChatTimer) clearTimeout(endChatTimer);
    };
  });

  function handleEndChat() {
    if (messages.length === 0) {
      startNewChat();
      return;
    }

    if (!isEndingChat) {
      isEndingChat = true;
      endChatTimer = setTimeout(() => {
        isEndingChat = false;
      }, 2000);
    } else {
      endChat();
    }
  }

  function startNewChat() {
    messages = [];
    inputMessage = '';
    conversationCount = 0;
    isEndingChat = false;
    if (endChatTimer) clearTimeout(endChatTimer);
  }

  function endChat() {
    messages = [...messages, { 
      text: "Finally! I'm out of here.", 
      isUser: false 
    }];
    
    setTimeout(() => {
      startNewChat();
    }, 2000);
  }

  function shouldEndConversation(conversationCount: number): boolean {
    if (conversationCount >= 5) {
      const threshold = Math.min((conversationCount - 4) * 0.1, 0.9); // Increment threshold after 5, max 90%
      return Math.random() < threshold;
    }
    return false;
  }

  async function sendMessage() {
    if (!inputMessage.trim()) return;

    messages = [...messages, { text: inputMessage, isUser: true }];
    const userMessage = inputMessage;
    inputMessage = '';
    isLoading = true;
    conversationCount++;

    try {
      
      if (shouldEndConversation(conversationCount)) {
        endChat();
        return;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          messageCount: conversationCount
        })
      });

      const data = await response.json();
      
      const responseMessage = data.message || data.error || "Whatever... *sigh*";
      
      messages = [...messages, { 
        text: responseMessage, 
        isUser: false 
      }];

      if (!data.success) {
        console.warn('API Warning:', data.error);
        
        if (response.status >= 500) {
          conversationCount = 0;
        }
      }
    } catch (error) {
      console.error('Client Error:', error);
      messages = [...messages, { 
        text: "I literally can't even handle this conversation right now.", 
        isUser: false 
      }];
      conversationCount = 0;
    } finally {
      isLoading = false;
    }
  }

  $: if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<AppShell>
  <div class="container mx-auto p-4 max-w-3xl h-screen flex flex-col">
    <header class="text-center mb-4">
      <h1 class="h1">AInnoyed</h1>
      <p class="text-surface-600-300-token">Chat with an increasingly disinterested AI</p>
    </header>

    <div 
      class="flex-1 overflow-y-auto bg-surface-100-800-token rounded-container-token p-4 mb-4"
      bind:this={chatContainer}
    >
      {#if messages.length === 0}
        <div class="text-center text-surface-600-300-token p-4">
          Start a conversation... if you must.
        </div>
      {/if}

      {#each messages as message}
        <div class="mb-4 flex {message.isUser ? 'justify-end' : 'justify-start'}">
          <div 
            class="max-w-[80%] {message.isUser ? 'bg-primary-500' : 'bg-surface-200-700-token'} p-3 rounded-container-token"
          >
            <p class="break-words">{message.text}</p>
          </div>
        </div>
      {/each}
      
      {#if isLoading}
        <div class="mb-4 flex justify-start">
          <div class="max-w-[80%] bg-surface-200-700-token p-3 rounded-container-token">
            <div class="flex gap-2">
              <div class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 0s"></div>
              <div class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 0.2s"></div>
              <div class="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style="animation-delay: 0.4s"></div>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <form 
      on:submit|preventDefault={sendMessage}
      class="flex gap-2"
    >
      <button 
        type="button" 
        class="btn {isEndingChat ? 'variant-filled-error' : 'variant-filled-primary'}" 
        on:click={handleEndChat}
        disabled={isLoading}
      >
        {#if messages.length === 0}
          Start New Chat
        {:else if isEndingChat}
          Are you sure?
        {:else}
          End Chat
        {/if}
      </button>

      <input
        type="text"
        bind:value={inputMessage}
        placeholder={messages.length === 0 ? "Start a new conversation..." : "Type something... or don't, whatever."}
        class="input w-full"
        disabled={isLoading || isEndingChat}
      />

      <button 
        type="submit" 
        class="btn variant-filled-primary" 
        disabled={isLoading || !inputMessage.trim() || isEndingChat}
      >
        Send
      </button>
    </form>
  </div>
</AppShell>

<style>
  .variant-filled-error {
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
    100% {
      opacity: 1;
    }
  }

  .btn:not(:disabled) {
    transition: transform 0.2s;
  }
  
  .btn:not(:disabled):hover {
    transform: scale(1.05);
  }
</style>

