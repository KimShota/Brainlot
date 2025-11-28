import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { initLlama, releaseAllLlama, LlamaContext } from 'llama.rn';
import { downloadModel } from '../lib/model';
import { generateLocalMcqs, LOCAL_MODEL, MCQ } from '../lib/localLLM';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { log, error as logError } from '../lib/logger';

type GenerationMode = 'local' | 'cloud';

interface LocalLLMContextValue {
  mode: GenerationMode | null;
  hasSelectedMode: boolean;
  isModelReady: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  showSelection: boolean;
  openSelection: () => void;
  closeSelection: () => void;
  activateLocalPlan: () => Promise<void>;
  activateCloudPlan: () => Promise<void>;
  ensureLocalReady: () => Promise<void>;
  generateBatch: (material: string) => Promise<MCQ[]>;
}

const LocalLLMContext = createContext<LocalLLMContextValue | undefined>(undefined);

const MODEL_DOWNLOAD_URL = `https://huggingface.co/${LOCAL_MODEL.repo}/resolve/main/${LOCAL_MODEL.file}`;
const STORAGE_KEYS = {
  mode: (userId: string) => `mcq_generation_mode_${userId}`,
  modelPath: 'local_llm_model_path',
};

export const LocalLLMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { isProUser } = useSubscription();
  const [mode, setMode] = useState<GenerationMode | null>(null);
  const [showSelection, setShowSelection] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isModelReady, setIsModelReady] = useState(false);
  const llamaRef = useRef<LlamaContext | null>(null);
  const [modelPath, setModelPath] = useState<string | null>(null);

  const storageModeKey = user?.id ? STORAGE_KEYS.mode(user.id) : null;

  const resetState = useCallback(async () => {
    setMode(null);
    setShowSelection(false);
    setIsModelReady(false);
    setDownloadProgress(0);
    setIsDownloading(false);
    if (llamaRef.current) {
      try {
        await releaseAllLlama();
      } catch (error) {
        logError('Error releasing llama context', error);
      } finally {
        llamaRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      void resetState();
    };
  }, [resetState]);

  useEffect(() => {
    if (!user?.id) {
      void resetState();
      return;
    }

    const hydrate = async () => {
      try {
        if (isProUser) {
          setMode('cloud');
          setShowSelection(false);
          return;
        }

        if (!storageModeKey) {
          setShowSelection(false);
          return;
        }

        const savedMode = await AsyncStorage.getItem(storageModeKey);
        if (!savedMode) {
          setShowSelection(true);
          return;
        }

        setMode(savedMode as GenerationMode);
        setShowSelection(false);
        if (savedMode === 'local') {
          await ensureLocalReady();
        }
      } catch (error) {
        logError('Error hydrating local LLM state', error);
        setShowSelection(true);
      }
    };

    hydrate();
  }, [user?.id, isProUser, storageModeKey, resetState]);

  const ensureModelOnDisk = useCallback(async () => {
    const destPath = `${RNFS.DocumentDirectoryPath}/${LOCAL_MODEL.file}`;
    const exists = await RNFS.exists(destPath);
    if (exists) {
      setModelPath(destPath);
      setDownloadProgress(100);
      return destPath;
    }

    setIsDownloading(true);
    setDownloadProgress(0);
    const path = await downloadModel(LOCAL_MODEL.file, MODEL_DOWNLOAD_URL, setDownloadProgress);
    setIsDownloading(false);
    setModelPath(path);
    return path;
  }, []);

  const ensureLocalReady = useCallback(async () => {
    if (isModelReady && llamaRef.current) {
      return;
    }

    try {
      const path = await ensureModelOnDisk();
      const context = await initLlama({
        model: path,
        use_mlock: true,
        n_ctx: 2048,
        n_gpu_layers: 1,
      });
      llamaRef.current = context;
      setIsModelReady(true);
      log('Local LLM loaded successfully');
    } catch (error) {
      logError('Failed to initialize local LLM', error);
      setIsModelReady(false);
      throw error;
    } finally {
      setIsDownloading(false);
    }
  }, [ensureModelOnDisk, isModelReady]);

  const persistMode = useCallback(
    async (nextMode: GenerationMode) => {
      if (!storageModeKey) {
        return;
      }
      await AsyncStorage.setItem(storageModeKey, nextMode);
      setMode(nextMode);
    },
    [storageModeKey]
  );

  const activateLocalPlan = useCallback(async () => {
    if (!user?.id) {
      throw new Error('Please sign in to continue.');
    }
    await persistMode('local');
    setShowSelection(false);
    await ensureLocalReady();
  }, [ensureLocalReady, persistMode, user?.id]);

  const activateCloudPlan = useCallback(async () => {
    if (!user?.id) {
      throw new Error('Please sign in to continue.');
    }
    await persistMode('cloud');
    setShowSelection(false);
  }, [persistMode, user?.id]);

  const generateBatch = useCallback(
    async (material: string) => {
      if (!material || !material.trim()) {
        throw new Error('No study material provided.');
      }
      await ensureLocalReady();
      if (!llamaRef.current) {
        throw new Error('Local LLM is not ready yet.');
      }
      return generateLocalMcqs({
        context: llamaRef.current,
        material,
      });
    },
    [ensureLocalReady]
  );

  const value = useMemo<LocalLLMContextValue>(
    () => ({
      mode,
      hasSelectedMode: Boolean(mode) || isProUser,
      isModelReady,
      isDownloading,
      downloadProgress,
      showSelection: showSelection && !isProUser,
      openSelection: () => setShowSelection(true),
      closeSelection: () => setShowSelection(false),
      activateLocalPlan,
      activateCloudPlan,
      ensureLocalReady,
      generateBatch,
    }),
    [
      mode,
      isProUser,
      isModelReady,
      isDownloading,
      downloadProgress,
      showSelection,
      activateLocalPlan,
      activateCloudPlan,
      ensureLocalReady,
      generateBatch,
    ]
  );

  return <LocalLLMContext.Provider value={value}>{children}</LocalLLMContext.Provider>;
};

export const useLocalLLM = () => {
  const context = useContext(LocalLLMContext);
  if (!context) {
    throw new Error('useLocalLLM must be used within a LocalLLMProvider');
  }
  return context;
};

