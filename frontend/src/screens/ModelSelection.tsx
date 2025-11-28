import { useState } from 'react';
import { Alert, TouchableOpacity, ScrollView } from 'react-native';
import axios from 'axios';
import {initLlama, releaseAllLlama} from 'llama.rn';
import RNFS from 'react-native-fs'; 
import { downloadModel } from '../lib/model';

type Message = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const INITIAL_CONVERSATION: Message[] = [
    {
      role: 'system',
      content:
        'This is a conversation between user and assistant, a friendly chatbot.',
    },
];

const [conversation, setConversation] = useState<Message[]>(INITIAL_CONVERSATION);
const [selectedModelFormat, setSelectedModelFormat] = useState<string>('');
const [selectedGGUF, setSelectedGGUF] = useState<string | null>(null);
const [availableGGUFs, setAvailableGGUFs] = useState<string[]>([]);
const [userInput, setUserInput] = useState<string>('');
const [progress, setProgress] = useState<number>(0);
const [context, setContext] = useState<any>(null);
const [isDownloading, setIsDownloading] = useState<boolean>(false);
const [isGenerating, setIsGenerating] = useState<boolean>(false);

const modelFormats = [
    {label: 'Llama-3.2-3B-Instruct'} //this will be shown to the user 
];
  
const HF_TO_GGUF = {
    "Llama-3.2-3B-Instruct": "bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q5_K_S.gguf" //repo that contains Llama-3.2-3B-Instruct
};

const fetchAvailableGGUFs = async (modelFormat: string) => {
    if (!modelFormat) {
      Alert.alert('Error', 'Please select a model format first.');
      return;
    }
  
    try {
      const repoPath = HF_TO_GGUF[modelFormat as keyof typeof HF_TO_GGUF];
      if (!repoPath) {
        throw new Error(
          `No repository mapping found for model format: ${modelFormat}`,
        );
      }
  
      //send query to huggingface to get the list of .gguf files 
      const response = await axios.get(
        `https://huggingface.co/api/models/${repoPath}`,
      );
  
      if (!response.data?.siblings) {
        throw new Error('Invalid API response format');
      }
  
      //keep only the gguf files 
      const files = response.data.siblings.filter((file: {rfilename: string}) =>
        file.rfilename.endsWith('.gguf'),
      );
  
      //store only the gguf file names in the state
      setAvailableGGUFs(files.map((file: {rfilename: string}) => file.rfilename));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch .gguf files';
      Alert.alert('Error', errorMessage);
      setAvailableGGUFs([]);
    }
};

const handleDownloadModel = async (file: string) => {
    //construct the download URL
    const downloadUrl = `https://huggingface.co/${
      HF_TO_GGUF[selectedModelFormat as keyof typeof HF_TO_GGUF]
    }/resolve/main/${file}`;
    // we set the isDownloading state to true to show the progress bar and set the progress to 0
    setIsDownloading(true);
    setProgress(0);
  
    try {
      // we download the model using the downloadModel function, it takes the selected GGUF file, the download URL, and a progress callback function to update the progress bar
      const destPath = await downloadModel(file, downloadUrl, progress =>
        setProgress(progress),
      );
      // if the download was successful, load the model into device's memory immediately 
      if (destPath){
        await loadModel(file); 
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Download failed due to an unknown error.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsDownloading(false);
    }
};

const loadModel = async (modelName: string) => {
    try {
      //get the destination path 
      const destPath = `${RNFS.DocumentDirectoryPath}/${modelName}`;
  
      // Ensure the model file exists before attempting to load it
      const fileExists = await RNFS.exists(destPath);
      if (!fileExists) {
        Alert.alert('Error Loading Model', 'The model file does not exist.');
        return false;
      }
  
      // if there is a context, set the context to null
      // we propably do not need this because we just want to keep generating MCQs infinitely and 
      // it is not a conversation
      if (context) {
        await releaseAllLlama();
        setContext(null);
        setConversation(INITIAL_CONVERSATION);
      }
  
      //load local LLM model into device's memory so that it can generate the output 
      // return LlamaContext object 
      const llamaContext = await initLlama({
        model: destPath,
        use_mlock: true, //prevents from moving memory pages to disk which is smaller than RAM
        n_ctx: 2048, //context window for LLM to generate the next output
        n_gpu_layers: 1 //how many transform layers you want to run matrix multiplications on the GPU
      });
      console.log("llamaContext", llamaContext);
      setContext(llamaContext); //store LlamaContext object into the state 
      return true;
    } catch (error) {
      Alert.alert('Error Loading Model', error instanceof Error ? error.message : 'An unknown error occurred.');
      return false;
    }
};
  

//button to run fetchAvailableGGUFs function and display the list of gguf files 
<TouchableOpacity onPress={() => fetchAvailableGGUFs('Llama-3.2-3B-Instruct')}>
  <Text>Fetch GGUF Files</Text>
</TouchableOpacity>
<ScrollView>
  {availableGGUFs.map((file) => (
    <Text key={file}>{file}</Text>
  ))}
</ScrollView>   

  
<View style={{ marginTop: 30, marginBottom: 15 }}>
  {Object.keys(HF_TO_GGUF).map((format) => (
    <TouchableOpacity
      key={format}
      onPress={() => {
        setSelectedModelFormat(format);
      }}
    >
      <Text> {format} </Text>
    </TouchableOpacity>
  ))}
</View>
<Text style={{ marginBottom: 10, color: selectedModelFormat ? 'black' : 'gray' }}>
  {selectedModelFormat 
    ? `Selected: ${selectedModelFormat}` 
    : 'Please select a model format before downloading'}
</Text>
<TouchableOpacity
  onPress={() => {
    handleDownloadModel("Llama-3.2-3B-Instruct-Q5_K_S.gguf");
  }}
>
  <Text>Download Model</Text>
</TouchableOpacity>
{isDownloading && <ProgressBar progress={progress} />}




    