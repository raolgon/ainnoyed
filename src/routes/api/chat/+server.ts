import { env } from "$env/dynamic/private";
import { json } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { HfInference } from '@huggingface/inference';

const hf = new HfInference(env.HUGGINGFACE_API_KEY);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const MAX_RETRIES = 3;
const COOLDOWN_MS = 1000;
let lastRequestTime = 0;

async function makeRequestWithRetry(message: string, retryCount = 0): Promise<string> {
    try {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < COOLDOWN_MS) {
            await delay(COOLDOWN_MS - timeSinceLastRequest);
        }
        lastRequestTime = Date.now();

        const prompt = `Instructions: You are a disinterested person who responds briefly and gets increasingly annoyed.
User's message: "${message}"
Your annoyed response:`;

        const response = await hf.textGeneration({
            model: 'meta-llama/Llama-3.3-70B-Instruct',
            inputs: prompt,
            parameters: {
                max_new_tokens: 50,
                temperature: 0.7,
                top_p: 0.95,
                return_full_text: false,
                stop: ["User:", "Assistant:", "\n", "Your annoyed response:"]
            }
        });

        if (!response?.generated_text) {
            throw new Error('No response generated');
        }

        let cleanResponse = response.generated_text
            .trim()
            .replace(/^(User|Assistant|Human|AI|Your annoyed response:)\s*:?\s*/gi, '')
            .replace(/\n/g, ' ')
            .trim();

        if (!cleanResponse) {
            const fallbacks = [
                "Whatever... *sigh*",
                "Do I really have to answer this?",
                "Can't you figure this out yourself?",
                "Ugh, fine...",
                "I guess I have to respond..."
            ];
            cleanResponse = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        }

        return cleanResponse;
    } catch (err) {
        console.error('API Error:', err);
        
        if (err instanceof Error && err.name === 'TooManyRequestsError' && retryCount < MAX_RETRIES) {
            const waitTime = Math.pow(2, retryCount) * 1000;
            console.log(`Rate limited. Waiting ${waitTime}ms before retry ${retryCount + 1}/${MAX_RETRIES}`);
            await delay(waitTime);
            return makeRequestWithRetry(message, retryCount + 1);
        }
        throw err;
    }
}

export const POST = async ({ request }: { request: Request }) => {
    try {
        const body = await request.json();
        
        if (!body.message) {
            return json({
                error: 'Message is required',
                success: false
            }, { status: 400 });
        }

        const assistantMessage = await makeRequestWithRetry(body.message);
        console.log('User message:', body.message);
        console.log('Assistant response:', assistantMessage);

        return json({
            message: assistantMessage,
            success: true
        });

    } catch (err) {
        console.error('Server Error:', err);
        
        if (err instanceof Error) {
            if (err.name === 'TooManyRequestsError') {
                return json({
                    error: 'Rate limit exceeded',
                    message: "Ugh, you're talking too fast. Give me a break.",
                    success: false
                }, { status: 429 });
            }

            return json({
                error: err.message,
                message: "I can't even right now... try again later.",
                success: false
            }, { status: 500 });
        }

        return json({
            error: 'Unknown error occurred',
            message: "Something's wrong, but I don't care enough to explain.",
            success: false
        }, { status: 500 });
    }
};
