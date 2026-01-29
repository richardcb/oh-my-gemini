/**
 * oh-my-gemini Hooks - Configuration Loader
 * 
 * Loads hook configuration with cascading priority:
 * 1. Project: .gemini/omg-config.json (highest)
 * 2. User: ~/.gemini/omg-config.json
 * 3. Defaults: bundled config.default.json (lowest)
 */

const fs = require('fs');
const path = require('path');

// Path to default config bundled with the extension
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config.default.json');

/**
 * Deep merge two objects
 * Source values override target values
 * @param {object} target - Base object
 * @param {object} source - Override object
 * @returns {object} Merged object
 */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') {
    return target;
  }

  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge objects
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        // Override with source value
        result[key] = sourceValue;
      }
    }
  }

  return result;
}

/**
 * Load default configuration
 * @returns {object} Default config
 */
function loadDefaultConfig() {
  try {
    if (fs.existsSync(DEFAULT_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));
    }
  } catch (err) {
    // Fall through to hardcoded defaults
  }

  // Hardcoded fallback defaults
  return {
    version: '2.0.0',

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
        'rm -rf /',
        'rm -rf ~',
        'rm -rf .',
        'sudo rm',
        'chmod 777',
        ':(){ :|:& };:'
      ],
      blockedPaths: [
        'node_modules',
        '.git',
        '/etc',
        '/usr',
        '/var',
        '/bin',
        '/sbin'
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
        'failed to',
        'unable to complete',
        "can't figure out",
        'hitting a wall'
      ]
    },

    contextInjection: {
      conductorState: true,
      gitHistory: {
        enabled: true,
        onKeywords: ['fix', 'bug', 'error', 'issue', 'broken', 'failing'],
        commitCount: 5
      },
      recentChanges: {
        enabled: true,
        onKeywords: ['continue', 'resume', 'where were we', 'pick up', 'last time'],
        fileCount: 10
      }
    }
  };
}

/**
 * Load user configuration from a file
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
    // Invalid JSON or file not readable - ignore
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
  const defaults = loadDefaultConfig();

  // Config file locations in priority order (lowest to highest)
  const configPaths = [];

  // User config (lower priority)
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (homeDir) {
    configPaths.push(path.join(homeDir, '.gemini', 'omg-config.json'));
  }

  // Project config (higher priority)
  if (projectRoot) {
    configPaths.push(path.join(projectRoot, '.gemini', 'omg-config.json'));
  }

  // Merge configs in order
  let config = defaults;

  for (const configPath of configPaths) {
    const userConfig = loadConfigFile(configPath);
    if (userConfig) {
      config = deepMerge(config, userConfig);
    }
  }

  return config;
}

/**
 * Get a specific config value by path
 * @param {object} config - Configuration object
 * @param {string} keyPath - Dot-separated path (e.g., 'phaseGates.strict')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Config value
 */
function getConfigValue(config, keyPath, defaultValue = undefined) {
  const keys = keyPath.split('.');
  let value = config;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }

  return value;
}

module.exports = {
  loadConfig,
  loadDefaultConfig,
  getConfigValue,
  deepMerge
};