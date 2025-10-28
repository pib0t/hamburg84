/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, ChangeEvent, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
// FIX: Use generatePimpImage from geminiService as generateHistoricalImage is not exported.
import { generatePimpImage } from './services/geminiService';
import PolaroidCard from './components/PolaroidCard';
// FIX: Use createLookbookPage from albumUtils as createDossierPage is not exported.
import { createLookbookPage } from './lib/albumUtils';
import Footer from './components/Footer';

// FIX: Update constants to match the prompts available in geminiService.
const PIMP_ARCHETYPES = ["Kiez-König", "Luden-Larry", "Gold-Zahn Günther", "Disco Dieter", "Porsche-Paul"];

// Pre-defined positions for a more organized look on desktop
const POSITIONS = [
    { top: '5%', left: '5%', rotate: -3 },
    { top: '5%', left: '55%', rotate: 2 },
    { top: '45%', left: '20%', rotate: 4 },
    { top: '35%', left: '65%', rotate: -2 },
    { top: '50%', left: '-5%', rotate: 5 },
];


type ImageStatus = 'pending' | 'done' | 'error';
interface GeneratedImage {
    status: ImageStatus;
    url?: string;
    error?: string;
}

// FIX: Update font to match the new theme.
const primaryButtonClasses = "font-permanent-marker text-xl text-center text-black bg-yellow-400 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:-rotate-2 hover:bg-yellow-300 shadow-[2px_2px_0px_2px_rgba(0,0,0,0.2)]";
const secondaryButtonClasses = "font-permanent-marker text-xl text-center text-white bg-white/10 backdrop-blur-sm border-2 border-white/80 py-3 px-8 rounded-sm transform transition-transform duration-200 hover:scale-105 hover:rotate-2 hover:bg-white hover:text-black";

const useMediaQuery = (query: string) => {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }, [matches, query]);
    return matches;
};

function App() {
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [appState, setAppState] = useState<'idle' | 'image-uploaded' | 'generating' | 'results-shown'>('idle');
    const dragAreaRef = useRef<HTMLDivElement>(null);
    const isMobile = useMediaQuery('(max-width: 768px)');


    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
                setAppState('image-uploaded');
                setGeneratedImages({}); // Clear previous results
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateClick = async () => {
        if (!uploadedImage) return;

        setIsLoading(true);
        setAppState('generating');
        
        const initialImages: Record<string, GeneratedImage> = {};
        PIMP_ARCHETYPES.forEach(pimp => {
            initialImages[pimp] = { status: 'pending' };
        });
        setGeneratedImages(initialImages);

        const concurrencyLimit = 2; // Process two at a time
        const pimpQueue = [...PIMP_ARCHETYPES];

        const processPimp = async (pimp: string) => {
            try {
                const resultUrl = await generatePimpImage(uploadedImage, pimp);
                setGeneratedImages(prev => ({
                    ...prev,
                    [pimp]: { status: 'done', url: resultUrl },
                }));
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
                setGeneratedImages(prev => ({
                    ...prev,
                    [pimp]: { status: 'error', error: errorMessage },
                }));
                console.error(`Failed to generate image for ${pimp}:`, err);
            }
        };

        const workers = Array(concurrencyLimit).fill(null).map(async () => {
            while (pimpQueue.length > 0) {
                const pimp = pimpQueue.shift();
                if (pimp) {
                    await processPimp(pimp);
                }
            }
        });

        await Promise.all(workers);

        setIsLoading(false);
        setAppState('results-shown');
    };

    const handleRegeneratePimp = async (pimp: string) => {
        if (!uploadedImage) return;

        if (generatedImages[pimp]?.status === 'pending') {
            return;
        }
        
        console.log(`Regenerating image for ${pimp}...`);

        setGeneratedImages(prev => ({
            ...prev,
            [pimp]: { status: 'pending' },
        }));

        try {
            const resultUrl = await generatePimpImage(uploadedImage, pimp);
            setGeneratedImages(prev => ({
                ...prev,
                [pimp]: { status: 'done', url: resultUrl },
            }));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            setGeneratedImages(prev => ({
                ...prev,
                [pimp]: { status: 'error', error: errorMessage },
            }));
            console.error(`Failed to regenerate image for ${pimp}:`, err);
        }
    };
    
    const handleReset = () => {
        setUploadedImage(null);
        setGeneratedImages({});
        setAppState('idle');
    };

    const handleDownloadIndividualImage = (pimp: string) => {
        const image = generatedImages[pimp];
        if (image?.status === 'done' && image.url) {
            const link = document.createElement('a');
            link.href = image.url;
            link.download = `hamburg-pimp-${pimp.toLowerCase().replace(' ', '-')}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleDownloadLookbook = async () => {
        setIsDownloading(true);
        try {
            const imageData = Object.entries(generatedImages)
                // FIX: Add explicit types to resolve 'property does not exist on type unknown' errors.
                .filter(([, image]: [string, GeneratedImage]) => image.status === 'done' && image.url)
                .reduce((acc, [pimp, image]: [string, GeneratedImage]) => {
                    acc[pimp] = image!.url!;
                    return acc;
                }, {} as Record<string, string>);

            if (Object.keys(imageData).length < PIMP_ARCHETYPES.length) {
                alert("Please wait for all images to finish generating before downloading the lookbook.");
                setIsDownloading(false);
                return;
            }

            const lookbookDataUrl = await createLookbookPage(imageData);

            const link = document.createElement('a');
            link.href = lookbookDataUrl;
            link.download = 'hamburg-84-lookbook.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error("Failed to create or download lookbook:", error);
            alert("Sorry, there was an error creating your lookbook. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <main className="bg-black text-neutral-200 min-h-screen w-full flex flex-col items-center justify-center p-4 pb-24 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-full bg-grid-white/[0.05]"></div>
            
            <div className="z-10 flex flex-col items-center justify-center w-full h-full flex-1 min-h-0">
                <div className="text-center mb-10">
                    {/* FIX: Update UI text and styles to match the new theme */}
                    <h1 className="text-5xl md:text-7xl font-monoton font-bold text-neutral-100 tracking-wider">Hamburg '84</h1>
                    <p className="font-special-elite text-neutral-300 mt-4 text-xl tracking-wide">Step onto the neon-drenched Reeperbahn.</p>
                </div>

                {appState === 'idle' && (
                     <div className="relative flex flex-col items-center justify-center w-full">
                        <motion.div
                             initial={{ opacity: 0, scale: 0.8 }}
                             animate={{ opacity: 1, scale: 1 }}
                             transition={{ delay: 0.5, duration: 0.8, type: 'spring' }}
                             className="flex flex-col items-center"
                        >
                            <label htmlFor="file-upload" className="cursor-pointer group transform hover:scale-105 transition-transform duration-300">
                                 <PolaroidCard 
                                     caption="Choose Your Mugshot"
                                     status="done"
                                 />
                            </label>
                            <input id="file-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp" onChange={handleImageUpload} />
                            <p className="mt-8 font-special-elite text-neutral-500 text-center max-w-xs text-lg">
                                Click the card to upload your photo and join the nightlife.
                            </p>
                        </motion.div>
                    </div>
                )}

                {appState === 'image-uploaded' && uploadedImage && (
                    <div className="flex flex-col items-center gap-6">
                         <PolaroidCard 
                            imageUrl={uploadedImage} 
                            caption="Your Mugshot" 
                            status="done"
                         />
                         <div className="flex items-center gap-4 mt-4">
                            <button onClick={handleReset} className={secondaryButtonClasses}>
                                Go Straight
                            </button>
                            <button onClick={handleGenerateClick} className={primaryButtonClasses}>
                                Hit the Streets
                            </button>
                         </div>
                    </div>
                )}

                {(appState === 'generating' || appState === 'results-shown') && (
                     <>
                        {isMobile ? (
                            <div className="w-full max-w-sm flex-1 overflow-y-auto mt-4 space-y-8 p-4">
                                {PIMP_ARCHETYPES.map((pimp) => (
                                    <div key={pimp} className="flex justify-center">
                                         <PolaroidCard
                                            caption={pimp}
                                            status={generatedImages[pimp]?.status || 'pending'}
                                            imageUrl={generatedImages[pimp]?.url}
                                            error={generatedImages[pimp]?.error}
                                            onShake={handleRegeneratePimp}
                                            onDownload={handleDownloadIndividualImage}
                                            isMobile={isMobile}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div ref={dragAreaRef} className="relative w-full max-w-5xl h-[600px] mt-4">
                                {PIMP_ARCHETYPES.map((pimp, index) => {
                                    const { top, left, rotate } = POSITIONS[index];
                                    return (
                                        <motion.div
                                            key={pimp}
                                            className="absolute cursor-grab active:cursor-grabbing"
                                            style={{ top, left }}
                                            initial={{ opacity: 0, scale: 0.5, y: 100, rotate: 0 }}
                                            animate={{ 
                                                opacity: 1, 
                                                scale: 1, 
                                                y: 0,
                                                rotate: `${rotate}deg`,
                                            }}
                                            transition={{ type: 'spring', stiffness: 100, damping: 20, delay: index * 0.15 }}
                                        >
                                            <PolaroidCard 
                                                dragConstraintsRef={dragAreaRef}
                                                caption={pimp}
                                                status={generatedImages[pimp]?.status || 'pending'}
                                                imageUrl={generatedImages[pimp]?.url}
                                                error={generatedImages[pimp]?.error}
                                                onShake={handleRegeneratePimp}
                                                onDownload={handleDownloadIndividualImage}
                                                isMobile={isMobile}
                                            />
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                         <div className="h-20 mt-4 flex items-center justify-center">
                            {appState === 'results-shown' && (
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <button 
                                        onClick={handleDownloadLookbook} 
                                        disabled={isDownloading} 
                                        className={`${primaryButtonClasses} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {isDownloading ? 'Creating Lookbook...' : 'Download Lookbook'}
                                    </button>
                                    <button onClick={handleReset} className={secondaryButtonClasses}>
                                        Start Over
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
            <Footer />
        </main>
    );
}

export default App;
