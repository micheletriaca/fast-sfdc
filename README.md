# fast-sfdc ⚡

[![BuyMeACoffee](https://raw.githubusercontent.com/pachadotdev/buymeacoffee-badges/main/bmc-yellow.svg)](https://buymeacoffee.com/micheletriaca)
[![GitHub Sponsor](https://img.shields.io/github/sponsors/micheletriaca?label=Sponsor&logo=GitHub)](https://github.com/sponsors/micheletriaca)

## Connect. Code. Save. Test. Done.

The fast Salesforce development loop, directly in VS Code. No Salesforce CLI, no heavyweight toolchain, no constant context switching.

**[→ Install fast-sfdc](https://marketplace.visualstudio.com/items?itemName=m1ck83.fast-sfdc)**

## From zero to working code

1. **Connect your org.** Click **fast-sfdc — not logged in** in the status bar, choose **Add credential**, then OAuth. Two clicks later, your org is ready. Keep multiple orgs in the project and switch between them from the same place.

2. **Create or edit metadata.** Run **Fast-Sfdc: Create new...** for an Apex class, trigger, Visualforce page or component, Aura bundle, LWC or custom field. Or just open an existing file and start coding.

3. **Save. It compiles.** Press `⌘ S`. The first time, enable deploy on save; from then on every save compiles the current Apex, Visualforce, Aura or LWC file directly in the active org. You immediately get success or compiler errors in VS Code.

4. **Bring changes back.** Right-click a file and choose **Retrieve**, or press `⌘ I R`. Need something that is not local yet? Open Package Explorer with `⌘ I P`, find it in the org and retrieve it straight into the project.

5. **Run the tests beside the code.** Open an Apex test class and click **Run test** or **Run all tests** in CodeLens. Results and coverage appear in the Output panel—no Developer Console required.

6. **Open Salesforce when you actually need it.** Click the active credential in the status bar and choose **Open Salesforce setup in browser**. You land in Setup already authenticated.

That is the whole loop: connect an org, change code, compile, retrieve metadata, run tests and jump into Setup without leaving your editor.

## The shortcuts worth remembering

| Action | macOS | Windows/Linux |
| --- | --- | --- |
| Deploy current file | `⌘ I D` | `Ctrl I D` |
| Retrieve current file | `⌘ I R` | `Ctrl I R` |
| Compile current file | `⌘ I C` | `Ctrl I C` |
| Execute Anonymous | `⌘ I E` | `Ctrl I E` |
| Open Package Explorer | `⌘ I P` | `Ctrl I P` |

## More when you need it

- **Syntax highlighting.** Apex classes, triggers and Anonymous Apex scripts have native syntax highlighting, as do Visualforce pages and components. You get the language support needed for everyday work without installing a heavyweight Salesforce toolchain.
- **Work on more than one file.** Multi-select files and folders in the VS Code Explorer, then deploy, retrieve or delete the whole selection from Salesforce. You can also deploy, retrieve and validate an entire project or folder.
- **Execute Apex without the Developer Console.** Run an entire `.apex` script—or just the selected lines—with `⌘ I E` (`Ctrl I E` on Windows/Linux). Debug logs and compiler or runtime errors stay in VS Code.
- **Create metadata.** Create Apex classes and triggers, Visualforce pages and components, Aura bundles, LWCs and custom fields. When creating a field, set its Profile access at the same time.
- **Explore the org.** Package Explorer shows metadata that is not in your project yet and can switch between the complete org and the types already used by the project. Select exactly what you need and retrieve it into the correct local structure; Profiles also have a dedicated retrieval flow.
- **Keep security changes close to the code.** Open a Profile or Permission Set and use CodeLens to edit field-level security without manually wrestling with the XML.
- **Handle the awkward parts.** Work with zipped static resources as regular folders, create destructive changesets from the Explorer and generate ready-to-edit [sfdy](https://github.com/micheletriaca/sfdy) plugins for repeatable pre-deploy and post-retrieve transformations.
- **Stop a deployment from anywhere.** Cancel a pending or in-progress deployment in the active org, even when it was started by another Fast-Sfdc instance, the Salesforce CLI, CI or a change set.
- **Use the project format you already have—or change it.** Metadata API and Salesforce DX source formats are both supported, and `package.xml` is optional. The command palette offers **Convert to Salesforce DX source format** or **Convert to Metadata API format**, based on the current project.
- **Keep every org one click away.** Add, switch, replace or remove Production, Sandbox and custom-domain credentials, and configure deploy on save or read-only mode independently for each org. Read-only orgs allow retrieve and local editing but block remote changes; writable production orgs let you validate before deploying, require confirmation and let you choose the Apex test level when tests are required. Credentials live in an encrypted project vault; its encryption key stays in the operating-system keychain, so the project never contains readable secrets.

For metadata transformations, run **Fast-Sfdc: Init metadata patching** and configure [sfdy](https://github.com/micheletriaca/sfdy).

Built from scratch for speed—and trusted in production since its first public release in 2020.

[Release notes](CHANGELOG.md) · [Source](https://github.com/micheletriaca/fast-sfdc) · [License](LICENSE.md)
