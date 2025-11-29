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
import {
  DEFAULT_LOCAL_MODEL_ID,
  LOCAL_MODELS,
  MCQ,
  generateLocalMcqs,
  getLocalModel,
  LocalModelDefinition,
} from '../lib/localLLM';
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
  localModels: LocalModelDefinition[];
  selectedLocalModelId: string;
  selectedLocalModel: LocalModelDefinition;
  selectLocalModel: (modelId: string) => Promise<void>;
  openSelection: () => void;
  closeSelection: () => void;
  activateLocalPlan: () => Promise<void>;
  activateCloudPlan: () => Promise<void>;
  ensureLocalReady: () => Promise<void>;
  generateBatch: (material: string) => Promise<MCQ[]>;
}

const LocalLLMContext = createContext<LocalLLMContextValue | undefined>(undefined);

// store which MCQ generation mode user selected to choose
const STORAGE_KEYS = {
  mode: (userId: string) => `mcq_generation_mode_${userId}`,
  localModel: (userId: string) => `local_llm_model_${userId}`,
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
  const [localModelId, setLocalModelId] = useState<string>(DEFAULT_LOCAL_MODEL_ID);

  const storageModeKey = user?.id ? STORAGE_KEYS.mode(user.id) : null;
  const localModelKey = user?.id ? STORAGE_KEYS.localModel(user.id) : null;
  const selectedLocalModel = useMemo(() => getLocalModel(localModelId), [localModelId]);

  // reset the entire localLLM state so that app can start fresh
  const resetState = useCallback(async () => {
    setMode(null);
    setShowSelection(false);
    setIsModelReady(false);
    setDownloadProgress(0);
    setIsDownloading(false);
    setLocalModelId(DEFAULT_LOCAL_MODEL_ID);
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

  // if the user navigates away from the localLLM context, reset the state
  useEffect(() => {
    return () => {
      void resetState();
    };
  }, [resetState]);

  // function to check if the model exists or not
  const ensureModelOnDisk = useCallback(
    async (model: LocalModelDefinition = selectedLocalModel) => {
    // construct the destination path 
    const destPath = `${RNFS.DocumentDirectoryPath}/${model.file}`;
    // check if the model already exists or not
    const exists = await RNFS.exists(destPath);

    // store the dest path into model path and set progress to 100 if it exists 
    if (exists) {
      setModelPath(destPath);
      setDownloadProgress(100);
      return destPath;
      }

      // if not, download the model by setting progress to 0
      setIsDownloading(true);
      setDownloadProgress(0);
      const modelUrl = `https://huggingface.co/${model.repo}/resolve/main/${model.file}`;
      const path = await downloadModel(model.file, modelUrl, setDownloadProgress);
      setIsDownloading(false);
      setModelPath(path);
      return path;
    },
    [selectedLocalModel]
  );

  const ensureLocalReady = useCallback(
    async (model: LocalModelDefinition = selectedLocalModel) => {
    // do nothing if the model is already loaded into memory
    if (isModelReady && llamaRef.current) {
      return;
    }

    try {
      const path = await ensureModelOnDisk(model); // download the model if GGUF file does not exist 
      // load the local LLM model into memory 
      const context = await initLlama({
        model: path,
        use_mlock: true, // prevent memory pages from moving to a disk which is way smaller than RAM 
        n_ctx: 2048, // define max token for context window (which includes user prompt, our prompt, response, etc)
        n_gpu_layers: 1, // how many transform layers we want to perform matrix multiplications through on GPU
      });
      llamaRef.current = context;
      setIsModelReady(true); // set the model as ready 
      log(`Local LLM (${model.label}) loaded successfully`);
    } catch (error) {
      logError('Failed to initialize local LLM', error);
      setIsModelReady(false);
      throw error;
    } finally {
      setIsDownloading(false);
    }
    },
    [ensureModelOnDisk, isModelReady, selectedLocalModel]
  );

  useEffect(() => {
    if (!user?.id) {
      void resetState();
      return;
    }

    const hydrate = async () => {
      try {
        // if the user is pro user, set the mode to cloud so that they can use gemini 
        if (isProUser) {
          setMode('cloud');
          setShowSelection(false);
          return;
        }

        // if no storage key exists, hide the selection mode 
        if (!storageModeKey) {
          setShowSelection(false);
          return;
        }

        const [savedMode, savedLocalModelId] = await Promise.all([
          AsyncStorage.getItem(storageModeKey),
          localModelKey ? AsyncStorage.getItem(localModelKey) : Promise.resolve(null),
        ]);

        const resolvedModel = getLocalModel(savedLocalModelId ?? undefined);
        setLocalModelId(resolvedModel.id);
        if (resolvedModel.id !== savedLocalModelId && localModelKey) {
          await AsyncStorage.setItem(localModelKey, resolvedModel.id);
        }

        // if the user has not chosen a mode, show the selection mode 
        if (!savedMode) {
          setShowSelection(true);
          return;
        }

        // if the user is free plan user, load the local LLM model
        setMode(savedMode as GenerationMode);
        setShowSelection(false);
        if (savedMode === 'local') {
          await ensureLocalReady(resolvedModel);
        }
      } catch (error) {
        logError('Error hydrating local LLM state', error);
        setShowSelection(true);
      }
    };

    hydrate();
  }, [user?.id, isProUser, storageModeKey, localModelKey, resetState, ensureLocalReady]);

  const persistMode = useCallback(
    async (nextMode: GenerationMode) => {
      if (!storageModeKey) {
        return;
      }
      // store storage mode key into asnycstorage so that app remembers mode permanently 
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

  // function to generate MCQs using local LLM
  const generateBatch = useCallback(
    async (material: string) => {
      // validate study material 
      if (!material || !material.trim()) {
        throw new Error('No study material provided.');
      }
      // ensure local LLM is loaded
      await ensureLocalReady();
      if (!llamaRef.current) {
        throw new Error('Local LLM is not ready yet.');
      }
      // return generated MCQs
      return generateLocalMcqs({
        context: llamaRef.current,
        material,
      });
    },
    [ensureLocalReady]
  );

  const selectLocalModel = useCallback(
    async (nextModelId: string) => {
      const nextModel = getLocalModel(nextModelId);
      if (nextModel.id === localModelId) {
        return;
      }
      if (llamaRef.current) {
        try {
          await releaseAllLlama();
        } catch (error) {
          logError('Error releasing llama context', error);
        } finally {
          llamaRef.current = null;
        }
      }
      setIsModelReady(false);
      setDownloadProgress(0);
      setModelPath(null);
      if (localModelKey) {
        await AsyncStorage.setItem(localModelKey, nextModel.id);
      }
      setLocalModelId(nextModel.id);
    },
    [localModelId, localModelKey]
  );

  // bundle all local-LLM-related state and actions into a single object 
  const value = useMemo<LocalLLMContextValue>(
    () => ({
      mode,
      hasSelectedMode: Boolean(mode) || isProUser,
      isModelReady,
      isDownloading,
      downloadProgress,
      showSelection: showSelection && !isProUser,
      localModels: LOCAL_MODELS,
      selectedLocalModelId: selectedLocalModel.id,
      selectedLocalModel,
      selectLocalModel,
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
      selectedLocalModel,
      selectLocalModel,
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

