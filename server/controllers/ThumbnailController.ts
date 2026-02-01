import { Request, Response } from "express";
import Thumbnail from "../models/Thumbnail.js";
import ai from "../configs/ai.js";
import path from "path";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

/* ================= STYLES ================= */

const stylePrompts = {
  "Bold & Graphic":
    "eye-catching thumbnail, bold typography, vibrant colors, expressive facial reaction, dramatic lighting, high contrast, click-worthy composition, professional style",
  "Tech/Futuristic":
    "futuristic thumbnail, sleek modern design, digital UI elements, glowing accents, holographic effects, cyber-tech aesthetic, sharp lighting",
  Minimalist:
    "minimalist thumbnail, clean layout, simple shapes, limited color palette, negative space, modern flat design",
  Photorealistic:
    "photorealistic thumbnail, ultra-realistic lighting, natural skin tones, DSLR photography, shallow depth of field",
  Illustrated:
    "illustrated thumbnail, stylized digital illustration, bold outlines, vibrant colors, cartoon or vector art style",
};

const colorSchemeDescriptions = {
  vibrant: "vibrant energetic colors, high saturation, bold contrast",
  sunset: "warm sunset tones, orange pink purple gradients, cinematic glow",
  forest: "natural green earthy tones, organic calm palette",
  neon: "neon glow, electric blues and pinks, cyberpunk lighting",
  purple: "purple dominant palette, magenta and violet tones",
  monochrome: "black and white, high contrast, dramatic lighting",
  ocean: "cool blue and teal tones, clean aquatic look",
  pastel: "soft pastel colors, gentle friendly tones",
};

/* ================= GENERATE ================= */

export const generateThumbnail = async (req: Request, res: Response) => {
  try {
    const { userId } = req.session as any;
    const {
      title,
      prompt: user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
    } = req.body;

    const thumbnail = await Thumbnail.create({
      userId,
      title,
      prompt_used: user_prompt,
      user_prompt,
      style,
      aspect_ratio,
      color_scheme,
      text_overlay,
      isGenerating: true,
    });

    /* ========= PROMPT ========= */

    const finalPrompt = `
YouTube thumbnail,
${stylePrompts[style as keyof typeof stylePrompts]},
Title concept: "${title}",
${color_scheme ? colorSchemeDescriptions[color_scheme as keyof typeof colorSchemeDescriptions] : ""}
${user_prompt ? `Extra details: ${user_prompt}` : ""}
Ultra high quality, professional YouTube thumbnail,
cinematic lighting, sharp focus, 4k resolution,
trending YouTube style, clean composition,
no watermark, no text artifacts, no blur
`;

    /* ========= AI CALL ========= */

    const response = await ai.post(
      "@cf/stabilityai/stable-diffusion-xl-base-1.0",
      {
        prompt: finalPrompt,
        width: aspect_ratio === "1:1" ? 1024 : 1280,
        height: aspect_ratio === "1:1" ? 1024 : 720,
        guidance_scale: 7.5,
        num_inference_steps: 40,
      },
    );

    const finalBuffer = Buffer.from(response.data);

    /* ========= FILE ========= */

    const filename = `thumbnail-${Date.now()}.png`;
    const filePath = path.join("images", filename);

    fs.mkdirSync("images", { recursive: true });
    fs.writeFileSync(filePath, finalBuffer);

    /* ========= UPLOAD ========= */

    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: "image",
    });

    thumbnail.image_url = uploadResult.secure_url;
    thumbnail.isGenerating = false;
    await thumbnail.save();

    fs.unlinkSync(filePath);

    res.json({
      message: "Thumbnail Generated Successfully",
      thumbnail,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* ================= DELETE ================= */

export const deleteThumbnail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.session as any;

    await Thumbnail.findByIdAndDelete({ _id: id, userId });
    res.json({ message: "Thumbnail deleted successfully" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};
