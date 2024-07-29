const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const sharp = require('sharp');
const os = require('os');
const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');
const cors = require('cors')({ origin: true, credentials: true });

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

exports.analyzeImage = onRequest({ cors: true }, async (req, res) => {
    // Wrap the function in cors middleware
    return cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).end();
        }

        const busboy = Busboy({ headers: req.headers });
        let imageBuffer;
        let imageFileName;

        busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
            if (fieldname !== 'image') {
                file.resume();
                return;
            }

            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                imageBuffer = Buffer.concat(chunks);
                imageFileName = filename;
            });
        });

        busboy.on('finish', async () => {
            if (!imageBuffer) {
                return res.status(400).json({ error: "No image file uploaded" });
            }

            try {
                // Process the image using Sharp
                const processedImageBuffer = await sharp(imageBuffer)
                    .resize(512, 512)
                    .jpeg()
                    .toBuffer();
                
                // Create a temporary file path
                const tempFilePath = path.join(os.tmpdir(), `image_${Date.now()}.jpg`);

                // Save the processed image to the temporary file
                fs.writeFileSync(tempFilePath, processedImageBuffer);

                // Converts local file information to a GoogleGenerativeAI.Part object.
                function fileToGenerativePart(path, mimeType) {
                    return {
                        inlineData: {
                            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
                            mimeType
                        },
                    };
                }
                
                // Turn images to Part objects
                const filePart1 = fileToGenerativePart(tempFilePath, "image/jpeg")
                const imageParts = [filePart1];

                // // Prepare the prompt for Gemini
                // const prompt = `Instruction
                // Please provide a clear and straightforward score for how handsome I am on a scale from 0 to 100. Briefly describe the basis for your score and the characteristics of my face. The response must be in JSON format and should not include any additional commentary. Regardless of the image quality or other factors, always provide a score and description.
                
                // Example
                // response: {'score': 90, 'reason': 'This person has a high nose and the overall look of his face is handsome. So it's 90 points.'}
                // response: {'score': 95, 'reason': 'His chiseled jawline and piercing blue eyes, framed by a head of thick, dark hair, gave him an effortlessly handsome appearance.'}
                // response: {'score': 85, 'reason': 'This person has symmetrical features, clear skin, and a friendly smile, making him quite handsome.'}
                // response: {'score': 78, 'reason': 'His slightly rugged look, combined with expressive eyes and a strong brow, gives him a distinctive and attractive appearance.'}
                // response: {'score': 92, 'reason': 'With high cheekbones, a well-defined chin, and striking eyes, he exudes a confident and handsome aura.'}
                // response: {'score': 88, 'reason': 'His well-groomed beard, combined with a warm smile and sharp features, make him notably handsome.'}
                // response: {'score': 82, 'reason': 'This person has a youthful appearance, bright eyes, and a proportional face, contributing to his handsome look.'}
                // response: {'score': 96, 'reason': 'His perfect symmetry, radiant smile, and captivating eyes make him exceptionally handsome.'}
                // response: {'score': 75, 'reason': 'While his features are generally pleasing, minor asymmetries and a less defined jawline slightly detract from his overall handsomeness.'}
                // response: {'score': 89, 'reason': 'A combination of well-defined facial features, expressive eyes, and a confident demeanor makes him very handsome.'}
                // response: {'score': 80, 'reason': 'His classic good looks are enhanced by a neat hairstyle and a genuine smile, making him attractive.'}
                // response: {'score': 91, 'reason': 'The striking contrast of his dark hair against his fair complexion, along with a strong jawline, contributes to his high score.'}
                // response: {'score': 65, 'reason': 'His facial features are somewhat asymmetrical, and his skin has some blemishes, which slightly detract from his overall appearance.'}
                // response: {'score': 60, 'reason': 'The person has a less defined jawline and thin lips, contributing to a more average appearance.'}
                // response: {'score': 55, 'reason': 'His facial features are plain and lack distinctiveness, giving him an ordinary look.'}
                // response: {'score': 50, 'reason': 'The person has a combination of minor facial asymmetries and a lack of striking features.'}
                // response: {'score': 48, 'reason': 'His eyes are somewhat small, and his nose is slightly disproportionate, resulting in a less balanced appearance.'}
                // response: {'score': 45, 'reason': 'The person’s face lacks strong definition and distinct features, making his appearance less memorable.'}
                // response: {'score': 40, 'reason': 'He has uneven skin tone and a weak chin, which affects his overall attractiveness.'}
                // response: {'score': 35, 'reason': 'The person has several prominent facial asymmetries and lacks standout features, leading to a lower score.'}
                // response: {'score': 30, 'reason': 'His face has noticeable imperfections and lacks symmetry, significantly affecting his handsomeness.'}
                // response: {'score': 25, 'reason': 'The person’s facial proportions are unbalanced, and he has noticeable blemishes, contributing to a lower attractiveness score.'}
                
                // Example of unwanted response (Never respond like this)
                // {"reason": "It is not possible to provide a score based on the provided image, as the subject's face is obscured. ", "score": 0}
                // {"reason": "The image quality is too poor to assess the person's appearance accurately.", "score": 0}
                // {"reason": "The subject's face is partially covered, making it impossible to provide a score.", "score": 0}
                // {"reason": "The provided image is too dark to see the person's facial features clearly.", "score": 0}
                // {"reason": "The angle of the image obscures important facial features, making it difficult to give a score.", "score": 0}
                // {"reason": "The image resolution is too low to evaluate the person's appearance properly.", "score": 0}
                
                // By clearly instructing the AI to avoid additional commentary and focus on a straightforward score and reason, the responses should become more direct and aligned with your requirements.`;

                // Prepare the prompt for Gemini
                const prompt = `Instruction
                Please provide a clear and straightforward score for the person's outfit style on a scale from 0 to 100. Briefly describe the basis for your score and the characteristics of the outfit. The response must be in JSON format and should not include any additional commentary. Regardless of the image quality or other factors, always provide a score and description.

                Example
                response: {'score': 90, 'reason': 'The person is wearing a stylish and well-coordinated outfit, with a modern jacket and fitted pants that complement each other perfectly.'}
                response: {'score': 95, 'reason': 'The outfit is exceptionally fashionable, featuring high-quality fabrics and a color palette that suits the person very well.'}
                response: {'score': 85, 'reason': 'The person has a great sense of style, with a smart casual look that is both trendy and comfortable.'}
                response: {'score': 78, 'reason': 'The outfit is unique and creative, with interesting patterns and a good mix of colors.'}
                response: {'score': 92, 'reason': 'The person's outfit exudes confidence and style, with a well-tailored suit and a matching tie.'}
                response: {'score': 88, 'reason': 'The person is dressed in a chic and fashionable manner, with a well-chosen combination of accessories.'}
                response: {'score': 82, 'reason': 'The outfit is neat and well-put-together, with a harmonious blend of colors and textures.'}
                response: {'score': 96, 'reason': 'The outfit is impeccable, with perfect fit, excellent fabric choice, and a stylish design.'}
                response: {'score': 75, 'reason': 'The outfit is generally pleasing but has minor mismatches in colors and accessories.'}
                response: {'score': 89, 'reason': 'The person's outfit is very stylish, with well-chosen pieces that complement each other nicely.'}
                response: {'score': 80, 'reason': 'The outfit is classic and well-coordinated, with a neat hairstyle and a genuine smile adding to the overall look.'}
                response: {'score': 91, 'reason': 'The outfit stands out with a strong sense of personal style, featuring bold colors and unique pieces.'}
                response: {'score': 65, 'reason': 'The outfit has some stylish elements but lacks cohesiveness and coordination.'}
                response: {'score': 60, 'reason': 'The person is dressed in a basic and average manner, with no standout features in the outfit.'}
                response: {'score': 55, 'reason': 'The outfit is plain and lacks distinctiveness, giving an ordinary look.'}
                response: {'score': 50, 'reason': 'The outfit has a combination of mismatched pieces and lacks a cohesive style.'}
                response: {'score': 48, 'reason': 'The person's outfit is somewhat outdated, with colors and styles that do not complement each other well.'}
                response: {'score': 45, 'reason': 'The outfit lacks definition and distinct features, making the overall appearance less memorable.'}
                response: {'score': 40, 'reason': 'The outfit is poorly coordinated with uneven colors and ill-fitting pieces.'}
                response: {'score': 35, 'reason': 'The outfit has several mismatches and lacks standout features, leading to a lower score.'}
                response: {'score': 30, 'reason': 'The outfit has noticeable imperfections and lacks harmony, significantly affecting the style.'}
                response: {'score': 25, 'reason': 'The outfit's proportions are unbalanced, and it has noticeable mismatches, contributing to a lower style score.'}

                Example of unwanted response (Never respond like this)
                {"reason": "It is not possible to provide a score based on the provided image, as the outfit is obscured. ", "score": 0}
                {"reason": "The image quality is too poor to assess the person's outfit accurately.", "score": 0}
                {"reason": "The subject's outfit is partially covered, making it impossible to provide a score.", "score": 0}
                {"reason": "The provided image is too dark to see the person's outfit clearly.", "score": 0}
                {"reason": "The angle of the image obscures important details of the outfit, making it difficult to give a score.", "score": 0}
                {"reason": "The image resolution is too low to evaluate the person's outfit properly.", "score": 0}

                By clearly instructing the AI to avoid additional commentary and focus on a straightforward score and reason, the responses should become more direct and aligned with your requirements.`;
        
                const model = genAI.getGenerativeModel({
                    model: 'gemini-1.5-flash',
                    safetySetting: [
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_UNSPECIFIED, threshold: HarmBlockThreshold.BLOCK_NONE },
                    ],
                    generationConfig: { responseMimeType: "application/json" }
                });

                const result = await model.generateContent([prompt, ...imageParts]);
                const response = await result.response;
                const text = response.text();
                
                // Clean up the temporary file
                fs.unlinkSync(tempFilePath);

                console.log(text)

                // Return the structured response
                res.status(200).json(JSON.parse(text));

            } catch (error) {
                console.error("Error analyzing image:", error);
                res.status(500).json({ error: "Internal Server Error" });
            }
        });

        busboy.end(req.rawBody);
    });
});