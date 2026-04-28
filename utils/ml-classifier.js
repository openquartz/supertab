/**
 * MLClassifier - 轻量化机器学习分类器
 * 
 * 实现Naive Bayes分类器、逻辑回归、决策树等轻量化算法
 * 用于智能标签页分组、场景分类、内容类型识别
 */

class MLClassifier {
  constructor(options = {}) {
    this.modelType = options.modelType || 'naive-bayes';
    this.storageKey = options.storageKey || 'tabflow:ml_model';
    this.vocabulary = new Map();
    this.classCounts = new Map();
    this.classWordCounts = new Map();
    this.weights = new Map();
    this.trained = false;
    this.trainingData = [];
    this.maxTrainingSamples = options.maxTrainingSamples || 1000;
    this.learningRate = options.learningRate || 0.01;
    this.regularization = options.regularization || 0.001;
    
    console.log('🤖 MLClassifier initialized with model:', this.modelType);
  }

  // ========== 文本预处理 ==========

  tokenize(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    const lowerText = text.toLowerCase();
    
    const tokens = lowerText
      .replace(/[^\w\u4e00-\u9fa5\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 1);
    
    const ngrams = [];
    for (const token of tokens) {
      ngrams.push(token);
    }
    
    for (let i = 0; i < tokens.length - 1; i++) {
      ngrams.push(`${tokens[i]}_${tokens[i + 1]}`);
    }
    
    return ngrams;
  }

  extractFeatures(tab) {
    const features = {
      tokens: [],
      domain: '',
      domainParts: [],
      path: '',
      pathParts: [],
      titleTokens: [],
      urlTokens: [],
      metadata: {
        visitCount: tab.visitCount || 1,
        lastAccessed: tab.lastAccessed || Date.now(),
        openedAt: tab.openedAt || Date.now()
      }
    };

    const url = tab.url || '';
    const title = tab.title || '';

    try {
      const urlObj = new URL(url);
      features.domain = urlObj.hostname;
      features.domainParts = urlObj.hostname.split('.');
      features.path = urlObj.pathname;
      features.pathParts = urlObj.pathname.split('/').filter(p => p);
      
      const queryParams = [];
      urlObj.searchParams.forEach((value, key) => {
        queryParams.push(key);
      });
      features.queryParams = queryParams;
    } catch (e) {
      features.domain = url;
    }

    features.titleTokens = this.tokenize(title);
    features.urlTokens = this.tokenize(url);
    features.domainTokens = this.tokenize(features.domain);

    features.tokens = [
      ...features.titleTokens,
      ...features.urlTokens,
      ...features.domainTokens
    ];

    return features;
  }

  // ========== Naive Bayes 分类器 ==========

  trainNaiveBayes(trainingData) {
    this.vocabulary.clear();
    this.classCounts.clear();
    this.classWordCounts.clear();

    for (const sample of trainingData) {
      const { features, label } = sample;
      
      if (!this.classCounts.has(label)) {
        this.classCounts.set(label, 0);
        this.classWordCounts.set(label, new Map());
      }
      
      this.classCounts.set(label, (this.classCounts.get(label) || 0) + 1);

      const wordCounts = this.classWordCounts.get(label);
      for (const token of features.tokens) {
        this.vocabulary.set(token, (this.vocabulary.get(token) || 0) + 1);
        wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
      }
    }

    this.trained = true;
    console.log('✅ Naive Bayes trained with', trainingData.length, 'samples');
  }

  predictNaiveBayes(features) {
    if (!this.trained) {
      return null;
    }

    const totalSamples = Array.from(this.classCounts.values()).reduce((a, b) => a + b, 0);
    const vocabSize = this.vocabulary.size;
    
    let bestLabel = null;
    let bestScore = -Infinity;

    for (const [label, count] of this.classCounts.entries()) {
      const prior = Math.log(count / totalSamples);
      
      let likelihood = 0;
      const wordCounts = this.classWordCounts.get(label);
      const totalWords = Array.from(wordCounts.values()).reduce((a, b) => a + b, 0);

      for (const token of features.tokens) {
        const wordCount = wordCounts.get(token) || 0;
        likelihood += Math.log((wordCount + 1) / (totalWords + vocabSize));
      }

      const score = prior + likelihood;
      
      if (score > bestScore) {
        bestScore = score;
        bestLabel = label;
      }
    }

    return { label: bestLabel, score: bestScore };
  }

  // ========== 逻辑回归分类器 ==========

  sigmoid(z) {
    if (z >= 500) return 1;
    if (z <= -500) return 0;
    return 1 / (1 + Math.exp(-z));
  }

  trainLogisticRegression(trainingData, iterations = 100) {
    const allFeatures = new Set();
    for (const sample of trainingData) {
      for (const token of sample.features.tokens) {
        allFeatures.add(token);
      }
    }

    const featureIndex = new Map();
    let idx = 0;
    for (const feature of allFeatures) {
      featureIndex.set(feature, idx++);
    }
    featureIndex.set('BIAS', idx);

    const numFeatures = featureIndex.size;
    const weights = new Float64Array(numFeatures);

    const labels = new Set(trainingData.map(d => d.label));
    const isBinary = labels.size === 2;
    const labelList = Array.from(labels);

    for (let iter = 0; iter < iterations; iter++) {
      for (const sample of trainingData) {
        const features = sample.features.tokens;
        const label = sample.label;

        let z = weights[featureIndex.get('BIAS')];
        for (const token of features) {
          if (featureIndex.has(token)) {
            z += weights[featureIndex.get(token)];
          }
        }

        const prediction = this.sigmoid(z);
        
        let target;
        if (isBinary) {
          target = label === labelList[0] ? 1 : 0;
        } else {
          target = 1;
        }

        const error = target - prediction;
        
        weights[featureIndex.get('BIAS')] += this.learningRate * error;
        for (const token of features) {
          if (featureIndex.has(token)) {
            const weightIdx = featureIndex.get(token);
            weights[weightIdx] += this.learningRate * error - this.regularization * weights[weightIdx];
          }
        }
      }
    }

    this.weights.clear();
    for (const [feature, index] of featureIndex.entries()) {
      this.weights.set(feature, weights[index]);
    }
    this.featureIndex = featureIndex;
    this.labels = labelList;
    this.trained = true;

    console.log('✅ Logistic Regression trained with', trainingData.length, 'samples');
  }

  predictLogisticRegression(features) {
    if (!this.trained || !this.featureIndex) {
      return null;
    }

    let z = this.weights.get('BIAS') || 0;
    for (const token of features.tokens) {
      if (this.weights.has(token)) {
        z += this.weights.get(token);
      }
    }

    const probability = this.sigmoid(z);
    
    return {
      label: probability > 0.5 ? (this.labels?.[0] || 'positive') : (this.labels?.[1] || 'negative'),
      score: probability,
      probability
    };
  }

  // ========== 决策树分类器 (简化版) ==========

  trainDecisionTree(trainingData, maxDepth = 5) {
    this.decisionTree = this.buildTree(trainingData, 0, maxDepth);
    this.trained = true;
    console.log('✅ Decision Tree trained with', trainingData.length, 'samples');
  }

  buildTree(data, depth, maxDepth) {
    if (depth >= maxDepth || data.length < 2) {
      const labelCounts = new Map();
      for (const sample of data) {
        labelCounts.set(sample.label, (labelCounts.get(sample.label) || 0) + 1);
      }
      let maxCount = 0;
      let majorityLabel = null;
      for (const [label, count] of labelCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          majorityLabel = label;
        }
      }
      return { type: 'leaf', label: majorityLabel, count: data.length };
    }

    const bestSplit = this.findBestSplit(data);
    
    if (!bestSplit) {
      const labelCounts = new Map();
      for (const sample of data) {
        labelCounts.set(sample.label, (labelCounts.get(sample.label) || 0) + 1);
      }
      let maxCount = 0;
      let majorityLabel = null;
      for (const [label, count] of labelCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          majorityLabel = label;
        }
      }
      return { type: 'leaf', label: majorityLabel, count: data.length };
    }

    const leftData = [];
    const rightData = [];
    
    for (const sample of data) {
      if (sample.features.tokens.includes(bestSplit.feature)) {
        leftData.push(sample);
      } else {
        rightData.push(sample);
      }
    }

    return {
      type: 'node',
      feature: bestSplit.feature,
      informationGain: bestSplit.gain,
      left: this.buildTree(leftData, depth + 1, maxDepth),
      right: this.buildTree(rightData, depth + 1, maxDepth)
    };
  }

  findBestSplit(data) {
    const allFeatures = new Set();
    for (const sample of data) {
      for (const token of sample.features.tokens) {
        allFeatures.add(token);
      }
    }

    let bestFeature = null;
    let bestGain = 0;

    const baseEntropy = this.calculateEntropy(data);

    for (const feature of allFeatures) {
      const hasFeature = [];
      const noFeature = [];

      for (const sample of data) {
        if (sample.features.tokens.includes(feature)) {
          hasFeature.push(sample);
        } else {
          noFeature.push(sample);
        }
      }

      if (hasFeature.length === 0 || noFeature.length === 0) continue;

      const hasEntropy = this.calculateEntropy(hasFeature);
      const noEntropy = this.calculateEntropy(noFeature);
      
      const weightedEntropy = 
        (hasFeature.length / data.length) * hasEntropy +
        (noFeature.length / data.length) * noEntropy;

      const gain = baseEntropy - weightedEntropy;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = feature;
      }
    }

    return bestFeature ? { feature: bestFeature, gain: bestGain } : null;
  }

  calculateEntropy(data) {
    const labelCounts = new Map();
    for (const sample of data) {
      labelCounts.set(sample.label, (labelCounts.get(sample.label) || 0) + 1);
    }

    let entropy = 0;
    const total = data.length;
    
    for (const count of labelCounts.values()) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  predictDecisionTree(features) {
    if (!this.trained || !this.decisionTree) {
      return null;
    }

    let node = this.decisionTree;
    
    while (node.type !== 'leaf') {
      if (features.tokens.includes(node.feature)) {
        node = node.left;
      } else {
        node = node.right;
      }
    }

    return { label: node.label, count: node.count };
  }

  // ========== 统一训练和预测接口 ==========

  train(trainingData) {
    if (!Array.isArray(trainingData) || trainingData.length === 0) {
      console.warn('⚠️ No training data provided');
      return false;
    }

    const processedData = trainingData.map(sample => ({
      features: sample.features || this.extractFeatures(sample.tab || sample),
      label: sample.label
    }));

    this.trainingData = [
      ...this.trainingData,
      ...processedData
    ].slice(-this.maxTrainingSamples);

    switch (this.modelType) {
      case 'logistic':
        this.trainLogisticRegression(this.trainingData);
        break;
      case 'decision-tree':
        this.trainDecisionTree(this.trainingData);
        break;
      case 'naive-bayes':
      default:
        this.trainNaiveBayes(this.trainingData);
        break;
    }

    return true;
  }

  predict(tab) {
    const features = this.extractFeatures(tab);

    switch (this.modelType) {
      case 'logistic':
        return this.predictLogisticRegression(features);
      case 'decision-tree':
        return this.predictDecisionTree(features);
      case 'naive-bayes':
      default:
        return this.predictNaiveBayes(features);
    }
  }

  predictTopK(tab, k = 3) {
    const features = this.extractFeatures(tab);
    const predictions = [];

    if (!this.trained || this.classCounts.size === 0) {
      return [];
    }

    const totalSamples = Array.from(this.classCounts.values()).reduce((a, b) => a + b, 0);
    const vocabSize = this.vocabulary.size;

    for (const [label, count] of this.classCounts.entries()) {
      const prior = Math.log(count / totalSamples);
      
      let likelihood = 0;
      const wordCounts = this.classWordCounts.get(label);
      const totalWords = wordCounts ? Array.from(wordCounts.values()).reduce((a, b) => a + b, 0) : 0;

      for (const token of features.tokens) {
        const wordCount = wordCounts ? (wordCounts.get(token) || 0) : 0;
        likelihood += Math.log((wordCount + 1) / (totalWords + vocabSize));
      }

      const score = prior + likelihood;
      predictions.push({ label, score });
    }

    return predictions
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  // ========== 在线学习 (增量训练) ==========

  learn(tab, label) {
    const features = this.extractFeatures(tab);
    
    this.trainingData.push({ features, label });
    if (this.trainingData.length > this.maxTrainingSamples) {
      this.trainingData.shift();
    }

    if (!this.classCounts.has(label)) {
      this.classCounts.set(label, 0);
      this.classWordCounts.set(label, new Map());
    }

    this.classCounts.set(label, (this.classCounts.get(label) || 0) + 1);

    const wordCounts = this.classWordCounts.get(label);
    for (const token of features.tokens) {
      this.vocabulary.set(token, (this.vocabulary.get(token) || 0) + 1);
      wordCounts.set(token, (wordCounts.get(token) || 0) + 1);
    }

    this.trained = true;
    console.log('📚 Online learning: added sample for label', label);
  }

  // ========== 模型持久化 ==========

  async save(storageManager) {
    const modelData = {
      modelType: this.modelType,
      vocabulary: Object.fromEntries(this.vocabulary),
      classCounts: Object.fromEntries(this.classCounts),
      classWordCounts: Object.fromEntries(
        Array.from(this.classWordCounts.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
      ),
      weights: Object.fromEntries(this.weights),
      trained: this.trained,
      trainingData: this.trainingData,
      featureIndex: this.featureIndex ? Object.fromEntries(this.featureIndex) : null,
      labels: this.labels,
      decisionTree: this.decisionTree
    };

    try {
      if (storageManager && typeof storageManager.setStorageData === 'function') {
        await storageManager.setStorageData(this.storageKey, modelData);
      } else if (chrome && chrome.storage && chrome.storage.local) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ [this.storageKey]: modelData }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve();
            }
          });
        });
      }
      console.log('💾 ML model saved');
      return true;
    } catch (error) {
      console.error('❌ Failed to save ML model:', error);
      return false;
    }
  }

  async load(storageManager) {
    try {
      let modelData;
      
      if (storageManager && typeof storageManager.getSettings === 'function') {
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get(this.storageKey, (data) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(data);
            }
          });
        });
        modelData = result[this.storageKey];
      } else if (chrome && chrome.storage && chrome.storage.local) {
        const result = await new Promise((resolve, reject) => {
          chrome.storage.local.get(this.storageKey, (data) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(data);
            }
          });
        });
        modelData = result[this.storageKey];
      }

      if (modelData) {
        this.modelType = modelData.modelType || this.modelType;
        this.vocabulary = new Map(Object.entries(modelData.vocabulary || {}));
        this.classCounts = new Map(Object.entries(modelData.classCounts || {}));
        this.classWordCounts = new Map(
          Object.entries(modelData.classWordCounts || {}).map(([k, v]) => [k, new Map(Object.entries(v))])
        );
        this.weights = new Map(Object.entries(modelData.weights || {}));
        this.trained = modelData.trained || false;
        this.trainingData = modelData.trainingData || [];
        if (modelData.featureIndex) {
          this.featureIndex = new Map(Object.entries(modelData.featureIndex));
        }
        this.labels = modelData.labels;
        this.decisionTree = modelData.decisionTree;
        
        console.log('📥 ML model loaded with', this.classCounts.size, 'classes');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ Failed to load ML model:', error);
      return false;
    }
  }

  getStats() {
    return {
      modelType: this.modelType,
      trained: this.trained,
      vocabularySize: this.vocabulary.size,
      classCount: this.classCounts.size,
      trainingSampleCount: this.trainingData.length,
      classes: Array.from(this.classCounts.entries())
    };
  }

  reset() {
    this.vocabulary.clear();
    this.classCounts.clear();
    this.classWordCounts.clear();
    this.weights.clear();
    this.trained = false;
    this.trainingData = [];
    this.featureIndex = null;
    this.labels = null;
    this.decisionTree = null;
    console.log('🔄 ML classifier reset');
  }
}

class EnsembleClassifier {
  constructor(options = {}) {
    this.classifiers = {
      naiveBayes: new MLClassifier({ modelType: 'naive-bayes', ...options }),
      logistic: new MLClassifier({ modelType: 'logistic', ...options }),
      decisionTree: new MLClassifier({ modelType: 'decision-tree', ...options })
    };
    this.weights = options.weights || {
      naiveBayes: 0.4,
      logistic: 0.35,
      decisionTree: 0.25
    };
  }

  train(trainingData) {
    let success = true;
    for (const [name, classifier] of Object.entries(this.classifiers)) {
      const result = classifier.train(trainingData);
      if (!result) success = false;
    }
    return success;
  }

  predict(tab) {
    const votes = new Map();
    const confidences = new Map();

    for (const [name, classifier] of Object.entries(this.classifiers)) {
      const result = classifier.predict(tab);
      if (result && result.label) {
        const weight = this.weights[name] || 1;
        const currentWeight = votes.get(result.label) || 0;
        votes.set(result.label, currentWeight + weight);
        
        const score = result.score || 0.5;
        const currentConfidence = confidences.get(result.label) || 0;
        confidences.set(result.label, currentConfidence + (score * weight));
      }
    }

    let bestLabel = null;
    let bestScore = 0;

    for (const [label, vote] of votes.entries()) {
      if (vote > bestScore) {
        bestScore = vote;
        bestLabel = label;
      }
    }

    return {
      label: bestLabel,
      score: bestScore,
      votes: Object.fromEntries(votes),
      confidences: Object.fromEntries(confidences)
    };
  }

  predictTopK(tab, k = 3) {
    const allPredictions = [];

    for (const [name, classifier] of Object.entries(this.classifiers)) {
      const predictions = classifier.predictTopK(tab, k);
      const weight = this.weights[name] || 1;
      
      for (const pred of predictions) {
        allPredictions.push({
          ...pred,
          score: pred.score * weight,
          classifier: name
        });
      }
    }

    const aggregated = new Map();
    for (const pred of allPredictions) {
      const current = aggregated.get(pred.label) || 0;
      aggregated.set(pred.label, current + pred.score);
    }

    return Array.from(aggregated.entries())
      .map(([label, score]) => ({ label, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async save(storageManager) {
    for (const [name, classifier] of Object.entries(this.classifiers)) {
      await classifier.save(storageManager);
    }
  }

  async load(storageManager) {
    for (const [name, classifier] of Object.entries(this.classifiers)) {
      await classifier.load(storageManager);
    }
  }

  learn(tab, label) {
    for (const classifier of Object.values(this.classifiers)) {
      classifier.learn(tab, label);
    }
  }

  getStats() {
    const stats = {};
    for (const [name, classifier] of Object.entries(this.classifiers)) {
      stats[name] = classifier.getStats();
    }
    return stats;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MLClassifier, EnsembleClassifier };
}

if (typeof window !== 'undefined') {
  window.MLClassifier = MLClassifier;
  window.EnsembleClassifier = EnsembleClassifier;
}
