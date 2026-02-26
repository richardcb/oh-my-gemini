/**
 * oh-my-gemini Hooks - Configuration Loader
 * 
 * Loads hook configuration with cascading priority:
 * 1. Project: .gemini/omg-config.json (highest)
 * 2. User: ~/.gemini/omg-config.json
 * 3. Defaults: hooks/config.default.json (lowest)
 * 
 * Updated for Windows/Unix cross-platform compatibility.
 */

const fs = require('fs');
const path = require('path');
const platform = require('./platform');

// Default configuration
const DEFAULT_CONFIG = {
  version: '1.0.0',
  
  phaseGates: {
    enabled: true,
    strict: false,
    phases: ['data-layer', 'backend', 'frontend', 'review']
  },
  
  autoVerification: {
    enabled: true,
    typecheck: true,
    lint: true,
    timeout: 30000
  },
  
  security: {
    gitCheckpoints: true,
    blockedCommands: [
      // Unix dangerous commands
      'rm -rf /',
      'rm -rf ~',
      'rm -rf .',
      'sudo rm',
      'chmod 777',
      ':(){ :|:& };:',
      'mkfs.',
      'dd if=',
      '> /dev/sd',
      // Windows dangerous commands
      'format c:',
      'rd /s /q c:',
      'del /f /s /q c:',
      'rmdir /s /q c:',
      'del /f /s /q %systemroot%',
      'reg delete hk'
    ],
    blockedPaths: [
      'node_modules',
      '.git',
      // Unix paths
      '/etc',
      '/usr',
      '/bin',
      '/sbin',
      '/var',
      '/root',
      // Windows paths
      'C:\\Windows',
      'C:\\Program Files',
      'C:\\Program Files (x86)',
      '%SystemRoot%',
      '%ProgramFiles%'
    ]
  },
  
  toolFilter: {
    enabled: true,
    modes: {
      researcher: {
        allowed: [
          'google_web_search',
          'web_fetch',
          'read_file',
          'list_dir',
          'glob'
        ]
      },
      architect: {
        allowed: [
          'read_file',
          'list_dir',
          'glob',
          'search_file_content'
        ]
      },
      executor: {
        allowed: '*'
      }
    }
  },
  
  ralph: {
    enabled: true,
    maxRetries: 5,
    triggerPatterns: [
      "I'm stuck",
      'I cannot',
      "I'm unable",
      'not possible',
      'failed to'
    ]
  },
  
  contextInjection: {
    enabled: true,
    conductorState: true,
    gitHistory: {
      enabled: true,
      onKeywords: ['fix', 'bug', 'error', 'issue', 'broken', 'crash'],
      commitCount: 5
    },
    recentChanges: {
      enabled: true,
      onKeywords: ['continue', 'resume', 'where were we', 'pick up', 'last time'],
      fileCount: 10
    }
  },
  
  debug: {
    enabled: false,
    logFile: null,
    verbose: false
  }
};

/**
 * Deep merge two objects
 * @param {object} target - Target object
 * @param {object} source - Source object to merge
 * @returns {object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

/**
 * Load configuration file if it exists
 * @param {string} configPath - Path to config file
 * @returns {object|null} Parsed config or null
 */
function loadConfigFile(configPath) {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    }
  } catch (err) {
    // Log error but don't fail
    if (process.env.OMG_DEBUG) {
      process.stderr.write(`[omg] Failed to load config from ${configPath}: ${err.message}\n`);
    }
  }
  return null;
}

/**
 * Load hook configuration with cascading priority
 * @param {string} projectRoot - Project root directory
 * @returns {object} Merged configuration
 */
function loadConfig(projectRoot) {
  // Start with defaults
  let config = { ...DEFAULT_CONFIG };
  
  // Try to load extension defaults (may have been updated)
  const extensionDefaultPath = path.join(__dirname, '..', 'config.default.json');
  const extensionDefaults = loadConfigFile(extensionDefaultPath);
  if (extensionDefaults) {
    config = deepMerge(config, extensionDefaults);
  }
  
  // Load user config from home directory
  const homeDir = platform.getHomeDir();
  const userConfigPath = path.join(homeDir, '.gemini', 'omg-config.json');
  const userConfig = loadConfigFile(userConfigPath);
  if (userConfig) {
    config = deepMerge(config, userConfig);
  }
  
  // Load project config (highest priority)
  if (projectRoot) {
    const projectConfigPath = path.join(projectRoot, '.gemini', 'omg-config.json');
    const projectConfig = loadConfigFile(projectConfigPath);
    if (projectConfig) {
      config = deepMerge(config, projectConfig);
    }
  }
  
  return config;
}

/**
 * Validate configuration object
 * @param {object} config - Configuration to validate
 * @returns {object} Validation result with valid flag and errors array
 */
function validateConfig(config) {
  const errors = [];
  
  // Check required fields
  if (!config.version) {
    errors.push('Missing version field');
  }
  
  // Validate security settings
  if (config.security) {
    if (config.security.blockedCommands && !Array.isArray(config.security.blockedCommands)) {
      errors.push('security.blockedCommands must be an array');
    }
    if (config.security.blockedPaths && !Array.isArray(config.security.blockedPaths)) {
      errors.push('security.blockedPaths must be an array');
    }
  }
  
  // Validate tool filter modes
  if (config.toolFilter && config.toolFilter.modes) {
    for (const [mode, settings] of Object.entries(config.toolFilter.modes)) {
      if (settings.allowed !== '*' && !Array.isArray(settings.allowed)) {
        errors.push(`toolFilter.modes.${mode}.allowed must be '*' or an array`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get a specific config value with dot notation
 * @param {object} config - Configuration object
 * @param {string} key - Dot-notation key (e.g., 'security.gitCheckpoints')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Config value or default
 */
function getConfigValue(config, key, defaultValue = undefined) {
  const parts = key.split('.');
  let value = config;
  
  for (const part of parts) {
    if (value === undefined || value === null || typeof value !== 'object') {
      return defaultValue;
    }
    value = value[part];
  }
  
  return value !== undefined ? value : defaultValue;
}

/**
 * Check if a feature is enabled in config
 * @param {object} config - Configuration object
 * @param {string} feature - Feature key (e.g., 'phaseGates', 'autoVerification')
 * @returns {boolean} True if feature is enabled
 */
function isFeatureEnabled(config, feature) {
  return getConfigValue(config, `${feature}.enabled`, false);
}

module.exports = {
  loadConfig,
  validateConfig,
  getConfigValue,
  isFeatureEnabled,
  DEFAULT_CONFIG
};
