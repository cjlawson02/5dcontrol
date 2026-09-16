package expo.modules.mdnsbrowse

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MdnsBrowseModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MdnsBrowse")
    Events("onServiceUpsert", "onServiceRemoved", "onError")

    Function("isSupported") {
      false
    }

    Function("startBrowsing") { _: String, _: String ->
      // Android browse is out of scope for M3 (iOS first).
    }

    Function("stopBrowsing") { }
  }
}
